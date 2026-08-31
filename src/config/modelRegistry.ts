import type { ModelId, RoutingScope } from "../routing/models.js";
import type { ModelTier } from "../routing/tiers.js";
import type { ModelCatalog } from "./modelCatalog.js";

export type ProviderProtocol = "anthropic" | "anthropic-compatible" | "openai-compatible";
export interface ModelCandidate { id: string; logicalModel?: ModelId; provider: string; protocol: ProviderProtocol; model: string; tier: ModelTier; enabled: boolean; capabilities: readonly ("tools" | "thinking" | "vision")[]; scopes: readonly RoutingScope[]; subagentType?: string; inputUsdPerMillion: number; outputUsdPerMillion: number; priority: number; }
export class ModelRegistry {
  constructor(readonly candidates: readonly ModelCandidate[]) {}
  resolve(tier: ModelTier, required: readonly string[], scope: RoutingScope = "main"): ModelCandidate | undefined {
    return this.candidates
      .filter((candidate) => candidate.enabled && candidate.tier === tier && candidate.logicalModel && candidate.scopes.includes(scope) && required.every((capability) => candidate.capabilities.includes(capability as "tools" | "thinking" | "vision")))
      .sort((a, b) => a.priority - b.priority)[0];
  }
}
export function defaultModelRegistry(catalog: ModelCatalog, deepseekEnabled: boolean): ModelRegistry {
  return new ModelRegistry([
    candidate("anthropic-haiku", "haiku", "anthropic", "anthropic", catalog.haiku, "low", true, ["main", "subagent-general"], undefined, 1, 5, 10),
    candidate("deepseek-v4-flash", "deepseek", "deepseek", "anthropic-compatible", catalog.deepseek, "low", deepseekEnabled, ["subagent-readonly"], "deepseek-explore", 0.44, 1.32, 10),
    candidate("anthropic-sonnet", "sonnet", "anthropic", "anthropic", catalog.sonnet, "standard", true, ["main", "subagent-readonly", "subagent-general"], undefined, 3, 15, 10),
    candidate("anthropic-opus", "opus", "anthropic", "anthropic", catalog.opus, "critical", true, ["main", "subagent-readonly", "subagent-general"], undefined, 5, 25, 10),
    candidate("glm-5.3-flash", undefined, "zai", "openai-compatible", "glm-5.3-flash", "low", false, ["main"], undefined, 0.075, 0.25, 10),
    candidate("glm-4.7", undefined, "zai", "openai-compatible", "glm-4.7", "standard", false, ["main"], undefined, 0.6, 2.2, 10),
    candidate("deepseek-v4-pro", undefined, "deepseek", "anthropic-compatible", "deepseek-v4-pro", "high", false, ["main"], undefined, 1.32, 3.96, 10),
    candidate("kimi-k2.7-code", undefined, "moonshot", "openai-compatible", "kimi-k2.7-code", "high", false, ["main"], undefined, 0, 0, 10),
    candidate("kimi-k3", undefined, "moonshot", "openai-compatible", "kimi-k3", "critical", false, ["main"], undefined, 0, 0, 20),
  ]);
}
function candidate(id: string, logicalModel: ModelId | undefined, provider: string, protocol: ProviderProtocol, model: string, tier: ModelTier, enabled: boolean, scopes: readonly RoutingScope[], subagentType: string | undefined, inputUsdPerMillion: number, outputUsdPerMillion: number, priority: number): ModelCandidate { return { id, logicalModel, provider, protocol, model, tier, enabled, capabilities: ["tools", "thinking"], scopes, subagentType, inputUsdPerMillion, outputUsdPerMillion, priority }; }
