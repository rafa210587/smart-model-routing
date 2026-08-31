import { type RouterConfig } from "../config/config.js";
import { type TaskClassifier } from "./classifier.js";
import { type ExecutionOrigin, type RoutingDecision } from "./models.js";
import { DefaultTaskAnalyzer, type TaskAnalyzer } from "./analyzer.js";
import { type ModelTier, chooseTier } from "./tiers.js";
import { ModelRegistry } from "../config/modelRegistry.js";

export class SmartRouter {
  constructor(private readonly config: RouterConfig, private readonly classifier?: TaskClassifier, private readonly analyzer: TaskAnalyzer = new DefaultTaskAnalyzer(), private readonly registry?: ModelRegistry) {}

  async route(prompt: string, origin: ExecutionOrigin = "main"): Promise<RoutingDecision> {
    try {
      const extracted = this.analyzer.analyze(prompt);
      let classifierTier: ModelTier | undefined;
      if (this.config.classifierEnabled && this.classifier) {
        try {
          const classified = await this.classifier.classify(prompt);
          classifierTier = classified.recommendedModel === "haiku" || classified.recommendedModel === "deepseek" ? "low" : classified.recommendedModel === "sonnet" ? "standard" : "critical";
        } catch { /* fail open below */ }
      }
      const intent = chooseTier(extracted, this.config.thresholds, classifierTier);
      const candidate = this.registry?.resolve(intent.tier, intent.requiredCapabilities);
      const model = candidate?.logicalModel ?? (intent.tier === "low" ? "haiku" : intent.tier === "standard" ? "sonnet" : "opus");
      return { model, tier: intent.tier, reason: intent.reason, confidence: intent.confidence, source: intent.source };
    } catch {
      return { model: this.config.defaultModel, tier: "standard", reason: "router error; safe default", confidence: 0, source: "fallback" };
    }
  }
}
