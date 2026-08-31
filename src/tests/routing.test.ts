import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ROUTER_CONFIG } from "../config/config.js";
import { DEFAULT_MODEL_CATALOG, providerModelFor } from "../config/modelCatalog.js";
import { parseClassification, type TaskClassifier } from "../routing/classifier.js";
import { decideDeterministically } from "../routing/deterministicRules.js";
import { selectModel } from "../routing/policy.js";
import { SmartRouter } from "../routing/router.js";
import { extractTaskFeatures, taskLabelForPrompt } from "../routing/taskFeatures.js";
import { defaultModelRegistry } from "../config/modelRegistry.js";

test("maps stable IDs to centralized provider model IDs", () => {
  assert.equal(providerModelFor(DEFAULT_MODEL_CATALOG, "haiku"), "claude-haiku-4-5-20251001");
  assert.equal(providerModelFor(DEFAULT_MODEL_CATALOG, "sonnet"), "claude-sonnet-4-6");
});

test("deterministic rules send simple reference lookup to Haiku", () => {
  const decision = decideDeterministically(extractTaskFeatures("find references to Foo"));
  assert.equal(decision?.model, "haiku");
  assert.equal(decision?.source, "deterministic");
});

test("user-facing task labels are specific and never unknown", () => {
  assert.equal(taskLabelForPrompt("Leia src/gateway/server.ts"), "consulta ao repositório");
  assert.equal(taskLabelForPrompt("faça algo sem classificação"), "solicitação geral");
});

test("normal implementation is conservatively routed to Sonnet", async () => {
  const router = new SmartRouter({ ...DEFAULT_ROUTER_CONFIG, classifierEnabled: false });
  const decision = await router.route("implement an endpoint to create invoices");
  assert.equal(decision.model, "sonnet");
});

test("read-only subagent routing selects DeepSeek by scope, while main low work keeps Haiku", async () => {
  const router = new SmartRouter({ ...DEFAULT_ROUTER_CONFIG, classifierEnabled: false, deepseekEnabled: true }, undefined, undefined, defaultModelRegistry(DEFAULT_MODEL_CATALOG, true));
  const prompt = "Leia somente src/gateway/server.ts e informe a classe exportada";
  assert.equal((await router.route(prompt, "main", "main")).model, "haiku");
  assert.deepEqual(await router.route(prompt, "subagent", "subagent-readonly"), {
    model: "deepseek", tier: "low", reason: "low-risk repository lookup or explanation", confidence: 0.94, source: "deterministic", subagentType: "deepseek-explore",
  });
});

test("distributed race condition is deterministically routed to Opus", async () => {
  const router = new SmartRouter(DEFAULT_ROUTER_CONFIG);
  const decision = await router.route("debug a distributed race condition in this payment flow");
  assert.equal(decision.model, "opus");
});

test("classifier output is normalized and invalid payloads are rejected", () => {
  const parsed = parseClassification({ task_type: "debugging", complexity: 1.4, ambiguity: -1, risk: "medium", multi_file: true, requires_implementation: false, requires_deep_reasoning: false, recommended_model: "sonnet", confidence: 0.8 });
  assert.deepEqual(parsed && { complexity: parsed.complexity, ambiguity: parsed.ambiguity, recommendedModel: parsed.recommendedModel }, { complexity: 1, ambiguity: 0, recommendedModel: "sonnet" });
  assert.equal(parseClassification({ task_type: "debugging", risk: "medium", complexity: 0.4, ambiguity: 0.2, confidence: 0.7, recommended_model: "gpt" }), undefined);
});

test("policy does not let classifier downgrade ordinary implementation to Haiku", () => {
  const features = { ...extractTaskFeatures("implement a retry strategy"), complexity: 0.2 };
  assert.equal(selectModel(features, DEFAULT_ROUTER_CONFIG, "haiku"), "sonnet");
});

test("classifier failure fails open to Sonnet", async () => {
  const failing: TaskClassifier = { classify: async () => { throw new Error("unavailable"); } };
  const decision = await new SmartRouter(DEFAULT_ROUTER_CONFIG, failing).route("investigate this ordinary error");
  assert.deepEqual({ model: decision.model, source: decision.source }, { model: "sonnet", source: "fallback" });
});
