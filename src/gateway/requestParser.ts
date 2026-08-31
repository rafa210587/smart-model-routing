import type { ExecutionOrigin, GatewayRequest } from "./types.js";
import { detectTurn as detectSessionTurn, type TurnDetection } from "../session/turnTracker.js";
export type { TurnDetection };

/** Extracts only text from user blocks; tool results are continuations, not new turns. */
export function detectTurn(request: GatewayRequest): TurnDetection {
  return Array.isArray(request.messages) ? detectSessionTurn(request.messages) : { type: "unknown" };
}

export function sessionIdFrom(headers: Headers, request: GatewayRequest): string {
  const headerId = headers.get("x-claude-code-session-id") ?? headers.get("x-session-id") ?? headers.get("anthropic-session-id");
  const metadataId = isRecord(request.metadata) && typeof request.metadata.user_id === "string"
    ? request.metadata.user_id : undefined;
  return headerId ?? metadataId ?? "anonymous";
}

/** Turns are sticky per Claude Code execution, not across its spawned agents. */
export function executionKeyFrom(headers: Headers, request: GatewayRequest): string {
  return `${sessionIdFrom(headers, request)}:${headers.get("x-claude-code-agent-id") ?? "main"}`;
}

export function originFrom(headers: Headers): ExecutionOrigin {
  const explicit = headers.get("x-smart-router-origin");
  if (explicit === "main" || explicit === "subagent") return explicit;
  // Claude Code documents these headers for spawned agents. The absence of both
  // on a Claude Code request denotes the main task; unknown callers stay unknown.
  if (headers.get("x-claude-code-agent-id") || headers.get("x-claude-code-parent-agent-id")) return "subagent";
  return headers.get("x-claude-code-session-id") ? "main" : "unknown";
}

export function parseGatewayRequest(value: unknown): GatewayRequest | undefined {
  return isRecord(value) ? value as GatewayRequest : undefined;
}

/** Privacy-safe request shape for diagnosing Claude Code protocol changes. */
export function messageShape(request: GatewayRequest): Record<string, unknown> {
  const messages = Array.isArray(request.messages) ? request.messages : [];
  const describe = (message: unknown) => {
    if (!isRecord(message)) return { role: "invalid", content_types: [] };
    const content = message.content;
    return {
      role: typeof message.role === "string" ? message.role : "unknown",
      content_types: Array.isArray(content) ? content.filter(isRecord).map((block) => typeof block.type === "string" ? block.type : "unknown") : typeof content === "string" ? ["string"] : [],
    };
  };
  return { message_count: messages.length, last: describe(messages.at(-1)), previous: describe(messages.at(-2)) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
