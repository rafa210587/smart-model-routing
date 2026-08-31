export type ApiKeyHeader = "authorization" | "x-api-key";

export async function forwardAnthropic(request: Request, body: unknown, providerBaseUrl: string, apiKey?: string, apiKeyHeader: ApiKeyHeader = "authorization"): Promise<Response> {
  const inbound = new Headers(request.headers);
  inbound.delete("host");
  inbound.delete("content-length");
  if (apiKey) {
    // The DeepSeek Anthropic endpoint explicitly supports x-api-key. Do not
    // forward the user's Anthropic credential to a third-party provider.
    inbound.delete("x-api-key"); inbound.delete("authorization");
    if (apiKeyHeader === "x-api-key") inbound.set("x-api-key", apiKey);
    else inbound.set("authorization", `Bearer ${apiKey}`);
  }
  const incoming = new URL(request.url);
  return fetch(`${providerBaseUrl.replace(/\/$/, "")}${incoming.pathname}${incoming.search}`, {
    method: request.method,
    headers: inbound,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : JSON.stringify(body),
    // Response streams are returned directly by fetch and deliberately never read/buffered.
    duplex: "half"
  } as RequestInit & { duplex: "half" });
}

export function proxyResponse(provider: Response): Response {
  const headers = new Headers(provider.headers);
  // fetch transparently decompresses upstream bodies. Forwarding the original
  // encoding would make Claude Code try to decompress an already plain stream.
  headers.delete("content-encoding");
  headers.delete("content-length");
  return new Response(provider.body, { status: provider.status, statusText: provider.statusText, headers });
}

export interface StreamUsage { inputTokens: number; outputTokens: number; hadToolUse: boolean; }

/** Observes SSE incrementally; it never waits for the complete provider response. */
export function withUsageFooter(provider: Response, onComplete: (usage: StreamUsage) => string | undefined): Response {
  if (!provider.body || !provider.headers.get("content-type")?.includes("text/event-stream")) return proxyResponse(provider);
  const headers = new Headers(provider.headers); headers.delete("content-encoding"); headers.delete("content-length");
  const decoder = new TextDecoder(); const encoder = new TextEncoder(); let pending = "";
  let inputTokens = 0; let outputTokens = 0; let hadToolUse = false; let maxIndex = -1;
  const process = (event: string): string => {
    const data = event.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
    try {
      const message = JSON.parse(data) as Record<string, unknown>;
      const usage = (message.usage ?? (message.message as Record<string, unknown> | undefined)?.usage) as Record<string, unknown> | undefined;
      if (typeof usage?.input_tokens === "number") inputTokens = usage.input_tokens;
      if (typeof usage?.output_tokens === "number") outputTokens = usage.output_tokens;
      if (message.type === "content_block_start") {
        if (typeof message.index === "number") maxIndex = Math.max(maxIndex, message.index);
        if ((message.content_block as Record<string, unknown> | undefined)?.type === "tool_use") hadToolUse = true;
      }
      if (message.type === "message_stop") {
        const footer = onComplete({ inputTokens, outputTokens, hadToolUse });
        if (footer && !hadToolUse) return footerEvents(maxIndex + 1, footer) + event;
      }
    } catch { /* opaque provider event: relay unchanged */ }
    return event;
  };
  const body = provider.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      pending += decoder.decode(chunk, { stream: true });
      let boundary: number;
      while ((boundary = pending.indexOf("\n\n")) >= 0) { controller.enqueue(encoder.encode(process(pending.slice(0, boundary + 2)))); pending = pending.slice(boundary + 2); }
    },
    flush(controller) { pending += decoder.decode(); if (pending) controller.enqueue(encoder.encode(process(pending))); },
  }));
  return new Response(body, { status: provider.status, statusText: provider.statusText, headers });
}

function footerEvents(index: number, footer: string): string {
  return `event: content_block_start\ndata: ${JSON.stringify({ type: "content_block_start", index, content_block: { type: "text", text: "" } })}\n\nevent: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index, delta: { type: "text_delta", text: footer } })}\n\nevent: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index })}\n\n`;
}
