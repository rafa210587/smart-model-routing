import { type ModelId } from "../routing/models.js";
import { type CurrentTurn } from "./turnTracker.js";

export interface SessionState { sessionId: string; currentTurn?: CurrentTurn; }

export class SessionTracker {
  private readonly sessions = new Map<string, SessionState>();
  get(sessionId: string): SessionState | undefined { return this.sessions.get(sessionId); }
  startTurn(sessionId: string, turnId: string, selectedModel: ModelId, startedAt = Date.now(), reason?: string, taskLabel = "unknown"): SessionState {
    const base = { turnId, selectedModel, startedAt, taskLabel, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };
    const currentTurn = reason === undefined ? base : { ...base, reason };
    const state = { sessionId, currentTurn };
    this.sessions.set(sessionId, state);
    return state;
  }
  retain(sessionId: string): ModelId | undefined { return this.sessions.get(sessionId)?.currentTurn?.selectedModel; }
  recordUsage(sessionId: string, inputTokens: number, outputTokens: number, inputPerMillion: number, outputPerMillion: number): CurrentTurn | undefined {
    const turn = this.sessions.get(sessionId)?.currentTurn;
    if (!turn) return undefined;
    turn.inputTokens += inputTokens; turn.outputTokens += outputTokens;
    turn.estimatedCostUsd += (inputTokens / 1_000_000) * inputPerMillion + (outputTokens / 1_000_000) * outputPerMillion;
    return turn;
  }
  aggregateSession(sessionId: string): { inputTokens: number; outputTokens: number; estimatedCostUsd: number } {
    const prefix = `${sessionId}:`;
    return [...this.sessions.entries()].filter(([key]) => key.startsWith(prefix)).reduce((total, [, state]) => ({
      inputTokens: total.inputTokens + (state.currentTurn?.inputTokens ?? 0),
      outputTokens: total.outputTokens + (state.currentTurn?.outputTokens ?? 0),
      estimatedCostUsd: total.estimatedCostUsd + (state.currentTurn?.estimatedCostUsd ?? 0),
    }), { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 });
  }
  end(sessionId: string): void { this.sessions.delete(sessionId); }
  get size(): number { return this.sessions.size; }
}
