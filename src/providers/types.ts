import type { ModelCandidate } from "../config/modelRegistry.js";
/** Boundary for provider-specific authentication and protocol conversion. */
export interface ProviderAdapter { readonly protocol: ModelCandidate["protocol"]; supports(candidate: ModelCandidate): boolean; }
export class AnthropicAdapter implements ProviderAdapter { readonly protocol = "anthropic" as const; supports(candidate: ModelCandidate): boolean { return candidate.protocol === this.protocol; } }
export class AnthropicCompatibleAdapter implements ProviderAdapter { readonly protocol = "anthropic-compatible" as const; supports(candidate: ModelCandidate): boolean { return candidate.protocol === this.protocol; } }
