import type { TaskFeatures } from "./taskFeatures.js";

export const MODEL_TIERS = ["low", "standard", "high", "critical"] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];
export interface RouteIntent { tier: ModelTier; reason: string; confidence: number; source: "deterministic" | "classifier" | "fallback"; requiredCapabilities: readonly ("tools" | "thinking" | "vision")[]; }

/** Provider-agnostic policy: it selects a tier, never a concrete model. */
export function chooseTier(features: TaskFeatures, thresholds: { haikuMaxComplexity: number; opusMinComplexity: number }, classifierTier?: ModelTier): RouteIntent {
  if (features.risk === "high" && features.requiresDeepReasoning) return route("critical", "high-risk task requiring deep reasoning", 0.96, "deterministic", ["tools", "thinking"]);
  if (features.taskType === "architecture" && features.requiresDeepReasoning) return route("critical", "complex architectural reasoning", 0.92, "deterministic", ["thinking"]);
  if (["lookup", "summarization", "explanation"].includes(features.taskType) && features.complexity < thresholds.haikuMaxComplexity && !features.requiresImplementation && features.risk === "low") return route("low", "low-risk repository lookup or explanation", 0.94, "deterministic", ["tools"]);
  if (classifierTier === "high" || classifierTier === "critical") return route(classifierTier, "classifier tier constrained by policy", 0.75, "classifier", ["tools", "thinking"]);
  if (classifierTier === "low" && features.risk === "low" && !features.requiresImplementation) return route("low", "classifier tier constrained by policy", 0.7, "classifier", ["tools"]);
  return route("standard", "conservative standard-tier decision", 0.6, "fallback", ["tools"]);
}

function route(tier: ModelTier, reason: string, confidence: number, source: RouteIntent["source"], requiredCapabilities: RouteIntent["requiredCapabilities"]): RouteIntent { return { tier, reason, confidence, source, requiredCapabilities }; }
