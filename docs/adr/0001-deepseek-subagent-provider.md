# ADR 0001: DeepSeek apenas para subagents de baixo risco

## Contexto

O Claude Code continua usando a API Anthropic através do gateway. DeepSeek oferece uma API compatível com Anthropic, incluindo streaming e ferramentas, mas a compatibilidade deve ser introduzida sem degradar a sessão principal.

## Decisão

Com `DEEPSEEK_API_KEY` e `DEEPSEEK_ENABLED=true`, o hook oficial `SubagentStart` pré-registra subagents do tipo `Explore` pelo seu `agent_id` para `deepseek-v4-flash`. O gateway usa o mesmo ID no header `X-Claude-Code-Agent-Id`. A tarefa principal continua no modelo Claude selecionado pelo router. Implementação, testes, debugging, arquitetura e qualquer caso ambíguo permanecem em Claude.

DeepSeek usa `https://api.deepseek.com/anthropic` por padrão e autenticação `Authorization: Bearer` própria. A chave Anthropic nunca é encaminhada ao DeepSeek.

## Consequências

O rollout é opt-in e fail-open: se DeepSeek não estiver configurado, ou houver erro, o gateway mantém o modelo Claude selecionado. A primeira validação real deve usar apenas subagents de leitura.
