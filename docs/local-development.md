# Desenvolvimento e validação local

Requer Node.js 22+ e acesso à API Anthropic. Instale e valide:

```bash
npm install
npm test
npm start
```

Variáveis suportadas:

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `8787` | Porta loopback do gateway |
| `ANTHROPIC_PROVIDER_BASE_URL` | `https://api.anthropic.com` | Upstream Anthropic |
| `ROUTER_DRY_RUN` | `false` | Não sobrescreve `model` |
| `ROUTER_TURN_SOURCE` | `hook` | `hook` usa UserPromptSubmit; `heuristic` é apenas diagnóstico legado |
| `ROUTER_ENABLED` | `true` | Ativa routing |
| `ROUTING_MODE` | `smart` | `smart`, `respect-explicit-model`, `disabled` |
| `CLASSIFIER_ENABLED` | `true` | Ativa classificador configurado |
| `HAIKU_MAX_COMPLEXITY` | `0.30` | Limite Haiku |
| `OPUS_MIN_COMPLEXITY` | `0.80` | Limite Opus |
| `ROUTER_HAIKU_MODEL`, `ROUTER_SONNET_MODEL`, `ROUTER_OPUS_MODEL` | IDs atuais | Mapeamento centralizado para o provider |
| `DEEPSEEK_API_KEY` | — | Chave do DeepSeek; necessária para subagents DeepSeek |
| `DEEPSEEK_ENABLED` | `false` | Autoriza o provider DeepSeek |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | ID encaminhado ao DeepSeek |

Teste manual com o gateway em execução:

1. Exporte `ANTHROPIC_BASE_URL=http://127.0.0.1:8787` e inicie `claude`.
2. Envie `find every usage of PaymentClient`; o log deve indicar Haiku.
3. Envie `implement retry with exponential backoff in PaymentClient`; deve indicar Sonnet.
4. Envie a análise da consistência distribuída/race condition; deve indicar Opus.
5. Faça uma tarefa que use Read, Grep, Edit e Bash. Todos os requests até a próxima entrada humana devem ter o mesmo modelo.
6. Peça explicitamente o subagent `deepseek-explore`. Desde a primeira chamada dele, o log deve ter `called_model: "deepseek-v4-flash"` e `provider: "deepseek"`; a sessão principal continua com um ID `claude-*`.

Esta máquina não tinha `node`, `npm` nem `claude` no `PATH` durante a entrega; execute estes passos em uma máquina com as ferramentas instaladas antes de uso produtivo.
