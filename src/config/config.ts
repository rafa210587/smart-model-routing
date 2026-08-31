import { type ModelId } from "../routing/models.js";

export type RoutingMode = "smart" | "respect-explicit-model" | "disabled";
export type TurnSource = "hook" | "heuristic";

export interface RouterConfig {
  enabled: boolean;
  mode: RoutingMode;
  dryRun: boolean;
  classifierEnabled: boolean;
  deepseekEnabled: boolean;
  turnSource: TurnSource;
  defaultModel: ModelId;
  thresholds: { haikuMaxComplexity: number; opusMinComplexity: number };
}

export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  enabled: true,
  mode: "smart",
  dryRun: false,
  classifierEnabled: true,
  deepseekEnabled: false,
  turnSource: "hook",
  defaultModel: "sonnet",
  thresholds: { haikuMaxComplexity: 0.3, opusMinComplexity: 0.8 },
};

function booleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes"].includes(value.toLowerCase());
}

function numberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

export function loadRouterConfig(env: Record<string, string | undefined> = process.env): RouterConfig {
  const mode = env.ROUTING_MODE;
  const defaultModel = env.ROUTER_DEFAULT_MODEL;
  const turnSource = env.ROUTER_TURN_SOURCE;
  return {
    enabled: booleanEnv(env.ROUTER_ENABLED, DEFAULT_ROUTER_CONFIG.enabled),
    mode: mode === "smart" || mode === "respect-explicit-model" || mode === "disabled" ? mode : DEFAULT_ROUTER_CONFIG.mode,
    dryRun: booleanEnv(env.ROUTER_DRY_RUN, DEFAULT_ROUTER_CONFIG.dryRun),
    classifierEnabled: booleanEnv(env.CLASSIFIER_ENABLED, DEFAULT_ROUTER_CONFIG.classifierEnabled),
    deepseekEnabled: booleanEnv(env.DEEPSEEK_ENABLED, DEFAULT_ROUTER_CONFIG.deepseekEnabled),
    turnSource: turnSource === "heuristic" || turnSource === "hook" ? turnSource : DEFAULT_ROUTER_CONFIG.turnSource,
    defaultModel: defaultModel === "haiku" || defaultModel === "sonnet" || defaultModel === "opus" ? defaultModel : DEFAULT_ROUTER_CONFIG.defaultModel,
    thresholds: {
      haikuMaxComplexity: numberEnv(env.HAIKU_MAX_COMPLEXITY, DEFAULT_ROUTER_CONFIG.thresholds.haikuMaxComplexity),
      opusMinComplexity: numberEnv(env.OPUS_MIN_COMPLEXITY, DEFAULT_ROUTER_CONFIG.thresholds.opusMinComplexity),
    },
  };
}
