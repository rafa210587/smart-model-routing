export type TaskType =
  | "lookup" | "explanation" | "summarization" | "implementation" | "testing"
  | "debugging" | "refactoring" | "code_review" | "architecture" | "unknown";
export type Risk = "low" | "medium" | "high";

export interface TaskFeatures {
  taskType: TaskType;
  complexity: number;
  ambiguity: number;
  risk: Risk;
  multiFile: boolean;
  requiresImplementation: boolean;
  requiresDeepReasoning: boolean;
}

const patterns: Array<[TaskType, RegExp]> = [
  ["architecture", /\b(architecture|redesign|distributed|consistency model|migration plan)\b/i],
  ["debugging", /\b(debug|bug|failing|failure|root cause|race condition)\b/i],
  ["implementation", /\b(implement|add|create|build|endpoint|integrat)\b/i],
  ["testing", /\b(test|spec|coverage)\b/i],
  ["refactoring", /\b(refactor|restructure|rename)\b/i],
  ["code_review", /\b(review|audit)\b/i],
  ["summarization", /\b(summarize|summary|resuma)\b/i],
  ["explanation", /\b(explain|why|como funciona)\b/i],
  ["lookup", /\b(find|search|grep|where|references?|usage|list|read|onde|referências?|usada|ler|leia|leitura|explore|explorar|localize|localizar)\b/i],
];

export function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Lightweight, intentionally conservative signal extraction for the MVP. */
export function extractTaskFeatures(prompt: string): TaskFeatures {
  const taskType = patterns.find(([, expression]) => expression.test(prompt))?.[0] ?? "unknown";
  const deep = /\b(distributed|race condition|concurrency|security|threat|consistency|architecture|redesign|migration)\b/i.test(prompt);
  const highRisk = /\b(security|auth|authorization|payment|financial|production|data loss)\b/i.test(prompt);
  const implementation = ["implementation", "testing", "refactoring"].includes(taskType);
  const multiFile = /\b(multi[- ]file|across|all modules|repository|codebase|\d+ modules)\b/i.test(prompt);
  const ambiguity = /\b(analyze|investigate|why|root cause|design|best)\b/i.test(prompt) ? 0.55 : 0.2;
  let complexity = taskType === "lookup" || taskType === "summarization" || taskType === "explanation" ? 0.15 : 0.55;
  if (implementation || multiFile) complexity += 0.12;
  if (deep) complexity += 0.25;
  return { taskType, complexity: clampUnit(complexity), ambiguity, risk: highRisk ? "high" : deep ? "medium" : "low", multiFile, requiresImplementation: implementation, requiresDeepReasoning: deep };
}

/** Human-readable task names; user-facing output must not expose "unknown". */
export function taskLabelForPrompt(prompt: string): string {
  const taskType = extractTaskFeatures(prompt).taskType;
  return {
    lookup: "consulta ao repositório",
    explanation: "explicação",
    summarization: "sumarização",
    implementation: "implementação",
    testing: "testes",
    debugging: "depuração",
    refactoring: "refatoração",
    code_review: "revisão de código",
    architecture: "arquitetura",
    unknown: "solicitação geral",
  }[taskType];
}
