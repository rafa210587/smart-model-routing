import { type RoutingDecision } from "./models.js";
import { type TaskFeatures } from "./taskFeatures.js";

/** Returns undefined when a classifier/policy decision is needed. */
export function decideDeterministically(features: TaskFeatures): RoutingDecision | undefined {
  if (features.risk === "high" && features.requiresDeepReasoning) {
    return { model: "opus", tier: "critical", reason: "high-risk task requiring deep reasoning", confidence: 0.96, source: "deterministic" };
  }
  if (features.taskType === "architecture" && features.requiresDeepReasoning) {
    return { model: "opus", tier: "critical", reason: "complex architectural reasoning", confidence: 0.92, source: "deterministic" };
  }
  if (["lookup", "summarization", "explanation"].includes(features.taskType) && features.complexity < 0.3 && !features.requiresImplementation && features.risk === "low") {
    return { model: "haiku", tier: "low", reason: "low-risk repository lookup or explanation", confidence: 0.94, source: "deterministic" };
  }
  return undefined;
}
