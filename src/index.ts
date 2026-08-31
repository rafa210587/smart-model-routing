import { loadRouterConfig } from "./config/config.js";
import { loadModelCatalog } from "./config/modelCatalog.js";
import { defaultModelRegistry } from "./config/modelRegistry.js";
import { startGateway } from "./gateway/server.js";
import { SmartRouter } from "./routing/router.js";
import { AnthropicHaikuClassifier } from "./routing/anthropicClassifier.js";

const config = loadRouterConfig({ ...process.env, DEEPSEEK_ENABLED: process.env.DEEPSEEK_ENABLED ?? (process.env.DEEPSEEK_API_KEY ? "true" : "false") });
const catalog = loadModelCatalog();
// This is deliberately distinct from ANTHROPIC_BASE_URL, which is set by the
// Claude Code client to point at this local gateway.
const providerBaseUrl = process.env.ANTHROPIC_PROVIDER_BASE_URL ?? "https://api.anthropic.com";
const classifier = config.classifierEnabled ? new AnthropicHaikuClassifier({
  providerBaseUrl,
  model: catalog.haiku,
  apiKey: process.env.ANTHROPIC_API_KEY,
  authToken: process.env.ANTHROPIC_AUTH_TOKEN,
}) : undefined;

startGateway({ providerBaseUrl, deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/anthropic", deepseekApiKey: process.env.DEEPSEEK_API_KEY, deepseekEnabled: config.deepseekEnabled, dryRun: config.dryRun, routingMode: config.enabled ? config.mode : "disabled", turnSource: config.turnSource, router: new SmartRouter(config, classifier, undefined, defaultModelRegistry(catalog, config.deepseekEnabled)), catalog });
