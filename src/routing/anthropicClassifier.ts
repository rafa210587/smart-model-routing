import { parseClassification, type Classification, type TaskClassifier } from "./classifier.js";

const CLASSIFIER_PROMPT = `Classify the user's software-engineering task. Choose the CHEAPEST Claude model that can execute it reliably. Do not solve the task. Return only one JSON object with task_type, complexity (0..1), ambiguity (0..1), risk (low|medium|high), multi_file, requires_implementation, requires_deep_reasoning, recommended_model (haiku|sonnet|opus), and confidence (0..1).`;

export interface AnthropicClassifierOptions {
  providerBaseUrl: string;
  model: string;
  apiKey?: string;
  authToken?: string;
  fetchImpl?: typeof fetch;
}

/** Direct-to-provider classifier. It never passes through the local gateway. */
export class AnthropicHaikuClassifier implements TaskClassifier {
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly options: AnthropicClassifierOptions) { this.fetchImpl = options.fetchImpl ?? fetch; }

  async classify(prompt: string): Promise<Classification> {
    const headers = new Headers({ "content-type": "application/json", "anthropic-version": "2023-06-01" });
    if (this.options.authToken) headers.set("authorization", `Bearer ${this.options.authToken}`);
    else if (this.options.apiKey) headers.set("x-api-key", this.options.apiKey);
    else throw new Error("Classifier credentials are not configured");
    const response = await this.fetchImpl(new URL("/v1/messages", this.options.providerBaseUrl), {
      method: "POST", headers,
      body: JSON.stringify({ model: this.options.model, max_tokens: 300, temperature: 0, system: CLASSIFIER_PROMPT, messages: [{ role: "user", content: prompt }] }),
    });
    if (!response.ok) throw new Error(`Classifier provider returned ${response.status}`);
    const body: unknown = await response.json();
    const text = textFromResponse(body);
    const parsed = text ? parseClassification(parseJsonObject(text)) : undefined;
    if (!parsed) throw new Error("Classifier returned invalid structured output");
    return parsed;
  }
}

function textFromResponse(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const content = (body as Record<string, unknown>).content;
  if (!Array.isArray(content)) return undefined;
  return content.filter((part): part is Record<string, unknown> => !!part && typeof part === "object")
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string).join("\n").trim() || undefined;
}

function parseJsonObject(text: string): unknown {
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? text;
  try { return JSON.parse(fenced); } catch { return undefined; }
}
