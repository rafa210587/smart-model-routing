# ADR 0002: Pinagem explícita de provider para subagents

## Contexto

A ADR 0001 tentou registrar um `Explore` no hook `SubagentStart` e desviar suas requisições posteriores ao DeepSeek. Na prática, o hook não cria uma associação confiável com a primeira requisição HTTP do agent. Isso permitiu que um subagent começasse em Claude e continuasse em DeepSeek, misturando histórico de ferramentas e thinking de providers distintos.

O endpoint Anthropic do DeepSeek suporta Claude Code, streaming, `thinking`, `tool_use` e `tool_result`, mas não suporta todos os blocos possíveis do Claude Code. Portanto, uma troca de provider após o início de uma conversa não é segura.

## Decisão

O provider de um subagent é definido antes da sua primeira chamada. Para usar DeepSeek, o projeto declara o subagent customizado `.claude/agents/deepseek-explore.md`:

```yaml
---
name: deepseek-explore
model: deepseek-v4-flash
---
```

O primeiro request desse subagent declara `model: deepseek-v4-flash`. O gateway reconhece esse ID, remove a credencial Anthropic da requisição, autentica no endpoint `https://api.deepseek.com/anthropic` com `x-api-key` e mantém cada continuação que também declarar esse modelo no DeepSeek. A sessão principal não declara esse modelo e continua no upstream Anthropic, sob as regras normais do router.

O hook `SubagentStart` deixa de alterar estado de roteamento. Não é permitido trocar Claude para DeepSeek dentro de um agent já iniciado. O gateway observa o uso DeepSeek e registra custo. Na resposta final (sem `tool_use`), inclui um rodapé `Smart Model Routing` com tipo de execução, tarefa, modelo, tokens e custo; respostas intermediárias com ferramentas não são alteradas.

## Consequências

- A sessão principal pode usar Claude enquanto `deepseek-explore` usa DeepSeek desde a primeira chamada.
- A configuração é opt-in e requer `DEEPSEEK_ENABLED=true` e `DEEPSEEK_API_KEY` no processo do gateway.
- O `Explore` integrado não muda de provider. A seleção é explícita: o agente principal deve chamar `deepseek-explore` quando a tarefa for somente leitura.
- A ADR 0001 é substituída por esta decisão.
