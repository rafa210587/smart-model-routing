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

Para validar implementação e testes em uma unidade isolada, o projeto também declara `.claude/agents/deepseek-worker.md`. Ele usa o mesmo modelo pinado, mas recebe ferramentas de leitura, edição e execução. É um override explícito de teste: a policy automática continua reservando o DeepSeek para o escopo `subagent-readonly` de baixa complexidade.

O hook `SubagentStart` deixa de alterar estado de roteamento. Não é permitido trocar Claude para DeepSeek dentro de um agent já iniciado. O gateway observa o uso DeepSeek e registra custo em eventos estruturados. O stream do subagent não recebe rodapé, pois Claude Code precisa consumi-lo sem alterações para recuperar o resultado do agent.

O hook `PreToolUse` do `Agent` consulta o `SmartRouter` **antes** de o subagent existir. Para uma solicitação ao agente integrado `Explore`, o `TaskAnalyzer` calcula complexidade e risco; a `PolicyEngine` escolhe o tier. No escopo `subagent-readonly`, o `ModelRegistry` pode resolver o candidato DeepSeek e informar `subagentType: deepseek-explore`; só então o hook substitui o tipo do agente. Não existe regra fixa `Explore -> DeepSeek`: tarefas fora de `LOW`, ou sem candidato compatível, mantêm o agente original.

## Consequências

- A sessão principal pode usar Claude enquanto `deepseek-explore` usa DeepSeek desde a primeira chamada.
- `deepseek-worker` permite validar escrita e tool-use no DeepSeek sem promover tarefas complexas normais para um modelo do tier `LOW`.
- A configuração é opt-in e requer `DEEPSEEK_ENABLED=true` e `DEEPSEEK_API_KEY` no processo do gateway.
- O usuário pede um `Explore` normalmente; a escolha de DeepSeek é automática e baseada em tier, complexidade, risco e escopo de ferramentas.
- A ADR 0001 é substituída por esta decisão.
