import { type RouterConfig } from "../config/config.js";
import { type ModelId } from "./models.js";
import { type TaskFeatures } from "./taskFeatures.js";

/** The classifier recommends; policy independently enforces the cost/reliability rules. */
export function selectModel(features: TaskFeatures, config: Pick<RouterConfig, "defaultModel" | "thresholds">, recommendation?: ModelId): ModelId {
  if (features.risk === "high" && features.requiresDeepReasoning) return "opus";
  if (features.taskType === "architecture" && features.requiresDeepReasoning && features.complexity >= config.thresholds.opusMinComplexity) return "opus";
  if (features.taskType === "lookup" && features.risk === "low" && features.complexity < config.thresholds.haikuMaxComplexity && !features.requiresImplementation) return "haiku";
  if (recommendation === "opus" && features.complexity >= config.thresholds.opusMinComplexity) return "opus";
  // Do not downgrade ambiguous engineering work solely because a classifier suggests Haiku.
  if (recommendation === "haiku" && features.complexity < config.thresholds.haikuMaxComplexity && features.risk === "low" && !features.requiresImplementation) return "haiku";
  return "sonnet";
}
