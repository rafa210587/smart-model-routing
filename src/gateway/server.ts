import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { forwardAnthropic, proxyResponse, withUsageFooter } from "./anthropicProxy.js";
import { detectTurn, executionKeyFrom, messageShape, originFrom, parseGatewayRequest, sessionIdFrom } from "./requestParser.js";
import type { EventLogger } from "../observability/logger.js";
import { JsonLogger } from "../observability/logger.js";
import { Metrics } from "../observability/metrics.js";
import type { GatewayRouter } from "./types.js";
import type { ModelCatalog } from "../config/modelCatalog.js";
import { MODEL_PRICING_USD_PER_MILLION, isDeepSeekModel, providerModelFor } from "../config/modelCatalog.js";
import { SessionTracker } from "../session/sessionTracker.js";
import type { RouterConfig, RoutingMode } from "../config/config.js";
import { extractTaskFeatures, taskLabelForPrompt } from "../routing/taskFeatures.js";

export interface GatewayOptions { providerBaseUrl: string; deepseekBaseUrl?: string; deepseekApiKey?: string; deepseekEnabled?: boolean; dryRun: boolean; router: GatewayRouter; catalog: ModelCatalog; routingMode?: RoutingMode; turnSource?: RouterConfig["turnSource"]; logger?: EventLogger; metrics?: Metrics; }

export class SmartGateway {
  readonly sessions = new SessionTracker();
  readonly metrics: Metrics;
  private readonly logger: EventLogger;
  constructor(private readonly options: GatewayOptions) { this.metrics = options.metrics ?? new Metrics(); this.logger = options.logger ?? new JsonLogger(); }

  async handle(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === "/health") return Response.json({ ok: true });
    if (new URL(request.url).pathname === "/metrics") return Response.json(this.metrics.snapshot(this.sessions.size));
    if (new URL(request.url).pathname === "/internal/turn" && request.method === "POST") return this.registerHumanTurn(request);
    if (new URL(request.url).pathname === "/internal/subagent-start" && request.method === "POST") return this.registerSubagent(request);
    if (request.method !== "POST") return new Response("Not found", { status: 404 });
    let raw: unknown;
    try { raw = await request.json(); } catch { return new Response("Expected JSON", { status: 400 }); }
    const body = parseGatewayRequest(raw); if (!body) return new Response("Expected JSON object", { status: 400 });
    if (new URL(request.url).pathname !== "/v1/messages") {
      try { return proxyResponse(await forwardAnthropic(request, body, this.options.providerBaseUrl)); }
      catch { return new Response("Upstream provider unavailable", { status: 502 }); }
    }
    const sessionId = sessionIdFrom(request.headers, body);
    const executionKey = executionKeyFrom(request.headers, body);
    const origin = originFrom(request.headers);
    const sessionModel = typeof body.model === "string" ? body.model : "unknown";
    const turn = detectTurn(body);
    let selectedProviderModel: string | undefined;
    const routingEnabled = (this.options.routingMode ?? "smart") === "smart";
    const explicitlyRequestedDeepSeek = isDeepSeekModel(this.options.catalog, body.model);
    let state = this.sessions.get(executionKey);

    // A custom Claude Code subagent declares its model on the first request.
    // That is the only safe place to choose DeepSeek:
    // never switch providers after Claude has already produced tool/thinking
    // history for the same agent.
    if (explicitlyRequestedDeepSeek) {
      if (!this.options.deepseekEnabled || !this.options.deepseekApiKey || !this.options.deepseekBaseUrl) {
        return Response.json({ type: "error", error: { type: "api_error", message: "DeepSeek subagent requested but DeepSeek is not configured" } }, { status: 503 });
      }
      if (state?.currentTurn?.selectedModel !== "deepseek" || turn.type === "new-human-turn") {
        const taskLabel = turn.type === "new-human-turn" ? taskLabelForPrompt(turn.prompt) : "exploração do repositório";
        state = this.sessions.startTurn(executionKey, randomUUID(), "deepseek", Date.now(), "explicit DeepSeek subagent model", taskLabel);
        this.metrics.decision("deepseek", "deterministic");
        this.logger.event("routing.decision", { session_id: sessionId, origin, turn_id: state.currentTurn?.turnId, selected_model: "deepseek", classification_source: "explicit-model", confidence: 1, reason: "Claude Code requested the DeepSeek subagent model" });
      }
    } else if (routingEnabled && this.options.turnSource === "heuristic" && turn.type === "new-human-turn" && turn.prompt) {
      const classificationStartedAt = Date.now();
      try {
        const decision = await this.options.router.route(turn.prompt, origin);
        this.metrics.classificationLatency(Date.now() - classificationStartedAt);
        const session = this.sessions.startTurn(executionKey, randomUUID(), decision.model, Date.now(), decision.reason, taskLabelForPrompt(turn.prompt));
        this.metrics.decision(decision.model, decision.source);
        this.logger.event("routing.decision", { session_id: sessionId, origin, turn_id: session.currentTurn?.turnId, selected_tier: decision.tier, selected_model: decision.model, classification_source: decision.source, confidence: decision.confidence, reason: decision.reason, dry_run: this.options.dryRun });
      } catch (error) {
        this.metrics.classificationLatency(Date.now() - classificationStartedAt);
        this.metrics.routerErrors++; this.metrics.fallbacks++;
        this.sessions.startTurn(executionKey, randomUUID(), "sonnet", Date.now(), "router error; safe fallback to Sonnet", "solicitação geral (fallback seguro)");
        this.logger.event("routing.fallback", { session_id: sessionId, reason: error instanceof Error ? error.message : "unknown" });
      }
    }
    state = this.sessions.get(executionKey);
    const selectedModel = explicitlyRequestedDeepSeek ? "deepseek" : state?.currentTurn?.selectedModel;
    if (routingEnabled && selectedModel) {
      this.metrics.request(selectedModel);
      if (!this.options.dryRun) { selectedProviderModel = providerModelFor(this.options.catalog, selectedModel); body.model = selectedProviderModel; }
    }
    this.logger.event("gateway.request", { session_id: sessionId, dry_run: this.options.dryRun, streaming: body.stream === true, turn_detection: turn.type, ...messageShape(body), session_model: sessionModel, called_model: selectedProviderModel ?? sessionModel, routing_reason: state?.currentTurn?.reason ?? "no routing decision registered" });
    try {
      const deepseek = selectedModel === "deepseek" && this.options.deepseekApiKey && this.options.deepseekBaseUrl;
      const upstream = await forwardAnthropic(request, body, deepseek ? this.options.deepseekBaseUrl! : this.options.providerBaseUrl, deepseek ? this.options.deepseekApiKey : undefined, deepseek ? "x-api-key" : "authorization");
      this.logger.event("gateway.upstream", { session_id: sessionId, provider: deepseek ? "deepseek" : "anthropic", status: upstream.status, requested_model: sessionModel, called_model: selectedProviderModel ?? sessionModel });
      return withUsageFooter(upstream, (usage) => {
        const logicalModel = state?.currentTurn?.selectedModel;
        if (!logicalModel) return undefined;
        const pricing = MODEL_PRICING_USD_PER_MILLION[logicalModel];
        const total = this.sessions.recordUsage(executionKey, usage.inputTokens, usage.outputTokens, pricing.input, pricing.output);
        if (!total) return undefined;
        const aggregate = this.sessions.aggregateSession(sessionId);
        this.logger.event("routing.session_usage", { session_id: sessionId, turn_id: total.turnId, input_tokens: aggregate.inputTokens, output_tokens: aggregate.outputTokens, estimated_cost_usd: Number(aggregate.estimatedCostUsd.toFixed(6)), task: total.taskLabel, session_model: sessionModel, called_model: selectedProviderModel ?? sessionModel, routing_reason: total.reason ?? "no routing decision registered" });
        // Tool-use responses are always continued by the agent; do not alter
        // their provider state. A response without tool_use is final, so the
        // footer safely exposes the subagent model and task in Claude Code.
        if (usage.hadToolUse) return undefined;
        const agentLabel = deepseek ? "subagent" : "sessão principal";
        return `\n\n---\nSmart Model Routing · ${agentLabel} · tarefa: ${total.taskLabel} · modelo: ${providerModelFor(this.options.catalog, logicalModel)} · tokens desta resposta: ${usage.inputTokens.toLocaleString("en-US")} entrada / ${usage.outputTokens.toLocaleString("en-US")} saída · custo desta resposta: US$ ${((usage.inputTokens / 1_000_000) * pricing.input + (usage.outputTokens / 1_000_000) * pricing.output).toFixed(6)}\nTotal da sessão (todos os agents): ${aggregate.inputTokens.toLocaleString("en-US")} entrada / ${aggregate.outputTokens.toLocaleString("en-US")} saída · US$ ${aggregate.estimatedCostUsd.toFixed(6)}`;
      });
    }
    catch (error) { return Response.json({ type: "error", error: { type: "api_error", message: "Upstream provider unavailable" } }, { status: 502 }); }
  }

  /** Called only by Claude Code's UserPromptSubmit hook, before the API request. */
  private async registerHumanTurn(request: Request): Promise<Response> {
    let input: unknown;
    try { input = await request.json(); } catch { return new Response("Expected JSON", { status: 400 }); }
    if (!input || typeof input !== "object") return new Response("Expected object", { status: 400 });
    const data = input as Record<string, unknown>;
    if (typeof data.session_id !== "string" || typeof data.prompt !== "string" || !data.prompt.trim()) return new Response("Expected session_id and prompt", { status: 400 });
    const routingEnabled = (this.options.routingMode ?? "smart") === "smart";
    if (!routingEnabled) return new Response(null, { status: 204 });
    const startedAt = Date.now();
    try {
      const decision = await this.options.router.route(data.prompt, "main");
      this.metrics.classificationLatency(Date.now() - startedAt);
      const taskLabel = taskLabelForPrompt(data.prompt);
      const session = this.sessions.startTurn(`${data.session_id}:main`, randomUUID(), decision.model, Date.now(), decision.reason, taskLabel);
      this.metrics.decision(decision.model, decision.source);
      this.logger.event("routing.decision", { session_id: data.session_id, origin: "main", turn_id: session.currentTurn?.turnId, selected_tier: decision.tier, selected_model: decision.model, classification_source: decision.source, confidence: decision.confidence, reason: decision.reason, dry_run: this.options.dryRun, source: "UserPromptSubmit" });
      return new Response(null, { status: 204 });
    } catch (error) {
      this.metrics.classificationLatency(Date.now() - startedAt); this.metrics.routerErrors++; this.metrics.fallbacks++;
      this.sessions.startTurn(`${data.session_id}:main`, randomUUID(), "sonnet", Date.now(), "router error; safe fallback to Sonnet", "solicitação geral (fallback seguro)");
      this.logger.event("routing.fallback", { session_id: data.session_id, reason: error instanceof Error ? error.message : "unknown", source: "UserPromptSubmit" });
      return new Response(null, { status: 204 });
    }
  }

  /**
   * Observation only. Hooks cannot alter a spawned agent's provider before its
   * first API request, so registering DeepSeek here caused unsafe mid-turn
   * Sonnet -> DeepSeek handoffs. Provider pinning now comes from the explicit
   * CLAUDE_CODE_SUBAGENT_MODEL request instead.
   */
  private async registerSubagent(request: Request): Promise<Response> {
    let input: unknown;
    try { input = await request.json(); } catch { return new Response("Expected JSON", { status: 400 }); }
    if (!input || typeof input !== "object") return new Response("Expected object", { status: 400 });
    const data = input as Record<string, unknown>;
    if (typeof data.session_id !== "string" || typeof data.agent_id !== "string" || typeof data.agent_type !== "string") return new Response("Expected session_id, agent_id and agent_type", { status: 400 });
    this.logger.event("subagent.start", { session_id: data.session_id, agent_id: data.agent_id, agent_type: data.agent_type, routing: "explicit-model-required" });
    return new Response(null, { status: 204 });
  }
}

export function startGateway(options: GatewayOptions, port = Number(process.env.PORT ?? 8787)): void {
  const gateway = new SmartGateway(options);
  createServer(async (req, res) => writeNodeResponse(res, await gateway.handle(await toRequest(req)))).listen(port, "127.0.0.1");
}
async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return new Request(`http://127.0.0.1${req.url}`, { method: req.method, headers: req.headers as Record<string, string>, body: ["GET", "HEAD"].includes(req.method ?? "GET") ? undefined : Buffer.concat(chunks) });
}
async function writeNodeResponse(res: ServerResponse, response: Response): Promise<void> {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (!response.body) return void res.end();
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) res.write(chunk);
  res.end();
}
