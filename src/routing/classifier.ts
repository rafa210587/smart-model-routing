import { isModelId, type ModelId } from "./models.js";
import { clampUnit, type Risk, type TaskFeatures, type TaskType } from "./taskFeatures.js";

export interface Classification extends TaskFeatures { recommendedModel: ModelId; confidence: number; }
export interface TaskClassifier { classify(prompt: string): Promise<Classification>; }

const taskTypes: readonly TaskType[] = ["lookup", "explanation", "summarization", "implementation", "testing", "debugging", "refactoring", "code_review", "architecture", "unknown"];
const risks: readonly Risk[] = ["low", "medium", "high"];

/** Validates untrusted structured classifier output before the policy can consume it. */
export function parseClassification(value: unknown): Classification | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Record<string, unknown>;
  const taskType = input.task_type ?? input.taskType;
  const recommendedModel = input.recommended_model ?? input.recommendedModel;
  const complexity = Number(input.complexity);
  const ambiguity = Number(input.ambiguity);
  const confidence = Number(input.confidence);
  if (!taskTypes.includes(taskType as TaskType) || !risks.includes(input.risk as Risk) || !isModelId(recommendedModel) || !Number.isFinite(complexity) || !Number.isFinite(ambiguity) || !Number.isFinite(confidence)) return undefined;
  return { taskType: taskType as TaskType, complexity: clampUnit(complexity), ambiguity: clampUnit(ambiguity), risk: input.risk as Risk, multiFile: Boolean(input.multi_file ?? input.multiFile), requiresImplementation: Boolean(input.requires_implementation ?? input.requiresImplementation), requiresDeepReasoning: Boolean(input.requires_deep_reasoning ?? input.requiresDeepReasoning), recommendedModel, confidence: clampUnit(confidence) };
}
