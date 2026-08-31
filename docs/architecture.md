# Arquitetura

`Claude Code -> Smart Gateway -> Anthropic Messages API | DeepSeek Anthropic API`.

O `SmartGateway` recebe os requests Anthropic e preserva headers, status, body e fluxo SSE do upstream. Para `POST /v1/messages`, ele extrai a última mensagem, identifica o turno e escolhe o modelo. `POST /v1/messages/count_tokens` é encaminhado sem roteamento.

O núcleo de routing é independente do gateway:

- `TaskAnalyzer` produz um perfil de tarefa independente de provider;
- `PolicyEngine` (`chooseTier`) seleciona `low`, `standard`, `high` ou `critical`, sem conhecer modelos concretos;
- `ModelRegistry` resolve o melhor candidato habilitado para o tier e capacidades exigidas;
- `ProviderAdapter` delimita os protocolos Anthropic, Anthropic-compatível e OpenAI-compatível;
- o classificador continua opcional e apenas sugere um tier, sujeito à política.

DeepSeek e Anthropic são os candidatos ativos. GLM e Kimi estão registrados como candidatos futuros, desativados até que seus adapters OpenAI-compatíveis, credenciais e evals sejam habilitados.

`MODEL_STICKINESS` é explicitamente `USER_TURN`. O estado é indexado por `X-Claude-Code-Session-Id`; cada novo turno substitui somente `currentTurn.selectedModel`. Requests de continuação (especialmente `tool_result`) reutilizam esse valor.

Para subagents DeepSeek, a pinagem não usa hooks nem inferência tardia. O subagent customizado `deepseek-explore` declara `model: deepseek-v4-flash` no frontmatter; o primeiro request já declara esse modelo, e o gateway o encaminha ao endpoint Anthropic do DeepSeek. Todas as continuações que declaram o mesmo modelo seguem no DeepSeek. A sessão principal segue no provider Claude.

Falhas no roteador resultam em Sonnet. Falhas do provider retornam o erro 502 Anthropic-style sem expor segredos. Logs guardam metadados de decisão, não o texto do prompt.
