import type { ExecutionOrigin, ModelId, RoutingDecision } from "../routing/models.js";
export type { ExecutionOrigin, ModelId, RoutingDecision };

export interface GatewayRequest {
  model?: string;
  messages?: unknown[];
  metadata?: Record<string, unknown>;
  stream?: boolean;
  [key: string]: unknown;
}

export interface GatewayRouter {
  route(prompt: string, origin: ExecutionOrigin): Promise<RoutingDecision>;
}
