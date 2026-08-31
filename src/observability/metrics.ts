import type { ModelId } from "../gateway/types.js";

export class Metrics {
  readonly routingDecisions = new Map<ModelId, number>();
  readonly requests = new Map<ModelId, number>();
  readonly classifications = new Map<string, number>();
  turns = 0;
  routerErrors = 0;
  fallbacks = 0;
  classificationLatencyMsTotal = 0;
  classificationLatencyCount = 0;

  decision(model: ModelId, source: string): void {
    this.routingDecisions.set(model, (this.routingDecisions.get(model) ?? 0) + 1);
    this.classifications.set(source, (this.classifications.get(source) ?? 0) + 1);
    this.turns++;
  }
  request(model: ModelId): void { this.requests.set(model, (this.requests.get(model) ?? 0) + 1); }
  classificationLatency(milliseconds: number): void {
    this.classificationLatencyMsTotal += milliseconds;
    this.classificationLatencyCount++;
  }
  snapshot(activeSessions: number): Record<string, unknown> {
    return { routing_decisions_total: Object.fromEntries(this.routingDecisions), requests_total: Object.fromEntries(this.requests), classification_total: Object.fromEntries(this.classifications), classification_latency_ms: { count: this.classificationLatencyCount, total: this.classificationLatencyMsTotal }, turns_total: this.turns, router_errors_total: this.routerErrors, fallback_total: this.fallbacks, sessions_active: activeSessions };
  }
}
