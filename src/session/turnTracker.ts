import { type ModelId } from "../routing/models.js";

export const MODEL_STICKINESS = "USER_TURN" as const;

export interface MessageLike { role?: unknown; content?: unknown; }
export type TurnDetection = { type: "new-human-turn"; prompt: string } | { type: "continuation" } | { type: "unknown" };

function textFromContent(content: unknown): string | undefined {
  if (typeof content === "string") return content.trim() || undefined;
  if (!Array.isArray(content)) return undefined;
  const parts = content.flatMap((block) => block && typeof block === "object" && (block as Record<string, unknown>).type === "text" && typeof (block as Record<string, unknown>).text === "string" ? [(block as Record<string, string>).text] : []);
  return parts.join("\n").trim() || undefined;
}

/** Tool results are user-role API messages but never open a new human turn. */
export function detectTurn(messages: readonly unknown[]): TurnDetection {
  const last = messages.at(-1);
  if (!last || typeof last !== "object" || Array.isArray(last)) return { type: "unknown" };
  const message = last as MessageLike;
  if (message.role !== "user") return { type: "continuation" };
  if (Array.isArray(message.content) && message.content.some((block) => block && typeof block === "object" && (block as Record<string, unknown>).type === "tool_result")) return { type: "continuation" };
  const previous = messages.at(-2);
  if (previous && typeof previous === "object" && !Array.isArray(previous)) {
    const previousMessage = previous as MessageLike;
    if (previousMessage.role === "assistant" && containsToolUse(previousMessage.content)) return { type: "continuation" };
  }
  const prompt = textFromContent(message.content);
  return prompt ? { type: "new-human-turn", prompt } : { type: "unknown" };
}

function containsToolUse(content: unknown): boolean {
  return Array.isArray(content) && content.some((block) => block && typeof block === "object" && (block as Record<string, unknown>).type === "tool_use");
}

export interface CurrentTurn { turnId: string; selectedModel: ModelId; startedAt: number; reason?: string; taskLabel: string; inputTokens: number; outputTokens: number; estimatedCostUsd: number; }
