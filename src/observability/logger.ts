export interface EventLogger { event(name: string, fields: Record<string, unknown>): void; }

export class JsonLogger implements EventLogger {
  constructor(private readonly debug = process.env.ROUTER_DEBUG === "true") {}
  event(name: string, fields: Record<string, unknown>): void {
    // Prompt bodies are intentionally never included here.
    if (name !== "routing.decision" || this.debug) process.stderr.write(`${JSON.stringify({ event: name, ...fields })}\n`);
  }
}
