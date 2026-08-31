import test from "node:test";
import assert from "node:assert/strict";
import { SmartGateway } from "../gateway/server.js";
import type { GatewayRouter } from "../gateway/types.js";
import type { ModelCatalog } from "../config/modelCatalog.js";

const catalog: ModelCatalog = { deepseek: "deepseek-test", haiku: "claude-haiku-test", sonnet: "claude-sonnet-test", opus: "claude-opus-test" };

function router(decisions: string[]): GatewayRouter {
  return { async route(prompt) { decisions.push(prompt); const critical = prompt.includes("architecture"); return { model: critical ? "opus" : "haiku", tier: critical ? "critical" : "low", source: "deterministic", confidence: 1, reason: "test" }; } };
}

test("one human turn routes once and keeps its model across tool continuation; next turn reroutes", async () => {
  const decisions: string[] = []; const providerModels: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    providerModels.push(JSON.parse(String(init?.body)).model);
    return new Response("event: message\ndata: {\"type\":\"message_stop\"}\n\n", { headers: { "content-type": "text/event-stream" } });
  };
  try {
    const gateway = new SmartGateway({ providerBaseUrl: "https://provider.example", dryRun: false, turnSource: "heuristic", router: router(decisions), catalog });
    const send = (messages: unknown[]) => gateway.handle(new Request("http://gateway.test/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-session-id": "s1" }, body: JSON.stringify({ model: "requested", stream: true, messages }) }));
    const first = await send([{ role: "user", content: "find references to PaymentClient" }]);
    assert.equal(first.headers.get("content-type"), "text/event-stream");
    await send([{ role: "assistant", content: [{ type: "tool_use", id: "t1", name: "Grep", input: {} }] }, { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "result" }] }]);
    await send([{ role: "user", content: "analyze architecture race condition" }]);
    assert.deepEqual(decisions, ["find references to PaymentClient", "analyze architecture race condition"]);
    assert.deepEqual(providerModels, ["claude-haiku-test", "claude-haiku-test", "claude-opus-test"]);
  } finally { globalThis.fetch = originalFetch; }
});

test("dry run records a decision but preserves caller model", async () => {
  const observed: string[] = []; const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => { observed.push(JSON.parse(String(init?.body)).model); return new Response("ok"); };
  try {
    const gateway = new SmartGateway({ providerBaseUrl: "https://provider.example", dryRun: true, turnSource: "heuristic", router: router([]), catalog });
    await gateway.handle(new Request("http://gateway.test/v1/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "claude-requested", messages: [{ role: "user", content: "find references" }] }) }));
    assert.deepEqual(observed, ["claude-requested"]);
  } finally { globalThis.fetch = originalFetch; }
});

test("an explicitly requested DeepSeek subagent is pinned from its first request", async () => {
  const calls: Array<{ url: string; model: string; authorization: string | null; apiKey: string | null }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), model: JSON.parse(String(init?.body)).model, authorization: new Headers(init?.headers).get("authorization"), apiKey: new Headers(init?.headers).get("x-api-key") });
    return new Response("event: message_stop\ndata: {\"type\":\"message_stop\",\"usage\":{\"input_tokens\":1,\"output_tokens\":1}}\n\n", { headers: { "content-type": "text/event-stream" } });
  };
  try {
    const gateway = new SmartGateway({ providerBaseUrl: "https://anthropic.example", deepseekBaseUrl: "https://deepseek.example/anthropic", deepseekApiKey: "deepseek-secret", deepseekEnabled: true, dryRun: false, turnSource: "hook", router: router([]), catalog });
    const send = (messages: unknown[]) => gateway.handle(new Request("http://gateway.test/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-session-id": "s1" }, body: JSON.stringify({ model: "deepseek-test", stream: true, messages }) }));
    const first = await send([{ role: "user", content: "read one file" }]);
    assert.doesNotMatch(await first.text(), /Smart Model Routing/);
    await send([{ role: "assistant", content: [{ type: "tool_use", id: "t1", name: "Read", input: {} }] }, { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "file contents" }] }]);
    assert.deepEqual(calls.map((call) => call.url), ["https://deepseek.example/anthropic/v1/messages", "https://deepseek.example/anthropic/v1/messages"]);
    assert.deepEqual(calls.map((call) => call.model), ["deepseek-test", "deepseek-test"]);
    assert.deepEqual(calls.map((call) => call.apiKey), ["deepseek-secret", "deepseek-secret"]);
    assert.deepEqual(calls.map((call) => call.authorization), [null, null]);
  } finally { globalThis.fetch = originalFetch; }
});

test("an explicit DeepSeek request fails clearly when the provider is disabled", async () => {
  const gateway = new SmartGateway({ providerBaseUrl: "https://provider.example", deepseekEnabled: false, dryRun: false, router: router([]), catalog });
  const response = await gateway.handle(new Request("http://gateway.test/v1/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "deepseek-test", messages: [{ role: "user", content: "read" }] }) }));
  assert.equal(response.status, 503);
});

test("pre-tool routing uses the policy decision to select the DeepSeek read-only agent", async () => {
  const originalFetch = globalThis.fetch;
  try {
    const gateway = new SmartGateway({ providerBaseUrl: "https://provider.example", deepseekEnabled: true, dryRun: false, router: {
      async route() { return { model: "deepseek", tier: "low", source: "deterministic", confidence: 0.94, reason: "low-risk repository lookup", subagentType: "deepseek-explore" }; },
    }, catalog });
    const response = await gateway.handle(new Request("http://gateway.test/internal/agent-route", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tool_name: "Agent", session_id: "s1", tool_input: { subagent_type: "Explore", prompt: "Read one file only", description: "inspect" } }) }));
    assert.deepEqual(await response.json(), { hookSpecificOutput: { hookEventName: "PreToolUse", updatedInput: { subagent_type: "deepseek-explore", prompt: "Read one file only", description: "inspect" }, additionalContext: "Smart Model Routing selecionou deepseek (low) para esta tarefa de subagent: low-risk repository lookup." } });
  } finally { globalThis.fetch = originalFetch; }
});
