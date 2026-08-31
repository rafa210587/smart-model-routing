import { type ModelId } from "../routing/models.js";

export interface ModelCatalog {
  readonly deepseek: string;
  readonly haiku: string;
  readonly sonnet: string;
  readonly opus: string;
}

export const MODEL_PRICING_USD_PER_MILLION = {
  deepseek: { input: 0.44, output: 1.32 },
  haiku: { input: 1, output: 5 },
  sonnet: { input: 3, output: 15 },
  opus: { input: 5, output: 25 },
} as const;

export const DEFAULT_MODEL_CATALOG: ModelCatalog = {
  deepseek: "deepseek-v4-flash",
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-7",
};

/** Provider names are centralized here and can be overridden without code edits. */
export function loadModelCatalog(env: Record<string, string | undefined> = process.env): ModelCatalog {
  return {
    deepseek: env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL_CATALOG.deepseek,
    haiku: env.ROUTER_HAIKU_MODEL?.trim() || DEFAULT_MODEL_CATALOG.haiku,
    sonnet: env.ROUTER_SONNET_MODEL?.trim() || DEFAULT_MODEL_CATALOG.sonnet,
    opus: env.ROUTER_OPUS_MODEL?.trim() || DEFAULT_MODEL_CATALOG.opus,
  };
}

export function providerModelFor(catalog: ModelCatalog, model: ModelId): string {
  return catalog[model];
}

/** Claude Code can request this model explicitly for all spawned subagents. */
export function isDeepSeekModel(catalog: ModelCatalog, requestedModel: unknown): boolean {
  return typeof requestedModel === "string" && requestedModel === catalog.deepseek;
}
