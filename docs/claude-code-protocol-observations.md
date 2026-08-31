# Observações do protocolo do Claude Code

Estas observações foram verificadas contra a documentação oficial em 31 de agosto de 2026; não foram capturados prompts, chaves ou tráfego privado nesta máquina.

- `ANTHROPIC_BASE_URL` é o mecanismo documentado para apontar Claude Code a um gateway. Um gateway no formato Anthropic deve suportar `POST /v1/messages` e `POST /v1/messages/count_tokens` e encaminhar `anthropic-version` e `anthropic-beta`. [LLM Gateway](https://code.claude.com/docs/en/llm-gateway)
- Requests padrão são a Messages API: `model`, `max_tokens`, `messages` e opcionalmente `stream`. A API é stateless; o histórico é enviado no corpo. [Messages API](https://platform.claude.com/docs/en/api/messages/create)
- `X-Claude-Code-Session-Id` é o identificador de sessão do Claude Code. `X-Claude-Code-Agent-Id` identifica subagent/teammate, e `X-Claude-Code-Parent-Agent-Id` é incluído quando o agente chamador também foi iniciado por outro agente. [LLM Gateway](https://code.claude.com/docs/en/llm-gateway)
- Streaming usa SSE. Eventos podem incluir `message_start`, `content_block_start`, deltas de texto e de input JSON para ferramentas, `message_delta` e `message_stop`; por isso o proxy repassa o corpo upstream diretamente. [Streaming Messages](https://platform.claude.com/docs/en/api/messages-streaming)
- `ANTHROPIC_AUTH_TOKEN` gera `Authorization: Bearer`, enquanto `ANTHROPIC_API_KEY` usa `X-Api-Key`. [Variáveis de ambiente](https://code.claude.com/docs/en/env-vars)

Não há identificador nativo de turno humano na Messages API. A detecção do MVP considera a última mensagem `user` com texto como um novo turno e reconhece blocos `tool_result` como continuação. Em caso de ambiguidade, ela não reclassifica.
