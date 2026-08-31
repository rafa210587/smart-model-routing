import { type ModelId } from "../routing/models.js";
import { type CurrentTurn } from "./turnTracker.js";

export interface SessionState { sessionId: string; currentTurn?: CurrentTurn; turns: CurrentTurn[]; }
export interface UsageTotals { inputTokens: number; outputTokens: number; estimatedCostUsd: number; }
export interface SessionUsage extends UsageTotals { byModel: Partial<Record<ModelId, UsageTotals>>; }

export class SessionTracker {
  private readonly sessions = new Map<string, SessionState>();
  get(sessionId: string): SessionState | undefined { return this.sessions.get(sessionId); }
  startTurn(sessionId: string, turnId: string, selectedModel: ModelId, startedAt = Date.now(), reason?: string, taskLabel = "unknown"): SessionState {
    const base = { turnId, selectedModel, startedAt, taskLabel, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };
    const currentTurn = reason === undefined ? base : { ...base, reason };
    const state = this.sessions.get(sessionId) ?? { sessionId, turns: [] };
    state.currentTurn = currentTurn;
    state.turns.push(currentTurn);
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
  aggregateSession(sessionId: string): SessionUsage {
    const prefix = `${sessionId}:`;
    const total: SessionUsage = { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, byModel: {} };
    for (const [, state] of this.sessions.entries()) {
      if (!state.sessionId.startsWith(prefix)) continue;
      for (const turn of state.turns) {
        total.inputTokens += turn.inputTokens;
        total.outputTokens += turn.outputTokens;
        total.estimatedCostUsd += turn.estimatedCostUsd;
        const byModel = total.byModel[turn.selectedModel] ?? { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };
        byModel.inputTokens += turn.inputTokens;
        byModel.outputTokens += turn.outputTokens;
        byModel.estimatedCostUsd += turn.estimatedCostUsd;
        total.byModel[turn.selectedModel] = byModel;
      }
    }
    return total;
  }
  end(sessionId: string): void { this.sessions.delete(sessionId); }
  get size(): number { return this.sessions.size; }
}
