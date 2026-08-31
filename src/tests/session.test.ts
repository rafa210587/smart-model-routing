import assert from "node:assert/strict";
import test from "node:test";
import { SessionTracker } from "../session/sessionTracker.js";
import { MODEL_STICKINESS, detectTurn } from "../session/turnTracker.js";

test("model stickiness is per user turn", () => {
  assert.equal(MODEL_STICKINESS, "USER_TURN");
  const sessions = new SessionTracker();
  sessions.startTurn("session-1", "turn-1", "sonnet", 123);
  assert.equal(sessions.retain("session-1"), "sonnet");
  sessions.startTurn("session-1", "turn-2", "haiku", 456);
  assert.deepEqual(sessions.get("session-1")?.currentTurn, { turnId: "turn-2", selectedModel: "haiku", startedAt: 456, taskLabel: "unknown", inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 });
});

test("a text user message starts a new human turn", () => {
  assert.deepEqual(detectTurn([{ role: "user", content: [{ type: "text", text: "implement retry" }] }]), { type: "new-human-turn", prompt: "implement retry" });
});

test("tool results are continuations even when represented as a user message", () => {
  const result = detectTurn([{ role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "result" }] }]);
  assert.deepEqual(result, { type: "continuation" });
});

test("text after an assistant tool call remains a continuation", () => {
  assert.deepEqual(detectTurn([
    { role: "assistant", content: [{ type: "tool_use", id: "tool_1", name: "Read", input: {} }] },
    { role: "user", content: "tool execution completed" },
  ]), { type: "continuation" });
});

test("unknown content does not cause unsafe reclassification", () => {
  assert.deepEqual(detectTurn([{ role: "user", content: [] }]), { type: "unknown" });
});
