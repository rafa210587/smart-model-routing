/** Stable router-facing identifiers; provider version strings live in ModelCatalog. */
export const MODEL_IDS = ["deepseek", "haiku", "sonnet", "opus"] as const;
export type ModelId = (typeof MODEL_IDS)[number];

export type DecisionSource = "deterministic" | "classifier" | "fallback";
export type ExecutionOrigin = "main" | "subagent" | "unknown";

export interface RoutingDecision {
  model: ModelId;
  tier: import("./tiers.js").ModelTier;
  reason: string;
  confidence: number;
  source: DecisionSource;
}

export function isModelId(value: unknown): value is ModelId {
  return typeof value === "string" && (MODEL_IDS as readonly string[]).includes(value);
}
