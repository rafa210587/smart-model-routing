# Smart Model Routing

Gateway local e transparente para o Claude Code que seleciona Haiku, Sonnet ou Opus por turno humano, mantendo o modelo durante todo o ciclo de ferramentas desse turno.

## Estado do MVP

O gateway é compatível com a API Messages da Anthropic, encaminha streaming sem bufferizar e apenas altera `model` quando o roteamento está ativo. Ele não altera mensagens, prompts de sistema, ferramentas ou resultados de ferramentas. O hook local em `.claude/settings.local.json` usa o evento oficial `UserPromptSubmit` para delimitar cada turno humano.

## Início rápido

1. Instale Node.js 22+ e as dependências: `npm install`.
2. Defina `ANTHROPIC_API_KEY` (ou `ANTHROPIC_AUTH_TOKEN`) normalmente para o Claude Code. O upstream padrão é `https://api.anthropic.com`.
3. Inicie o gateway: `npm start`.
4. Em outro terminal, use `ANTHROPIC_BASE_URL=http://127.0.0.1:8787` antes de iniciar `claude`.
5. Para delegar uma exploração ao DeepSeek, peça explicitamente o subagent customizado `deepseek-explore`. A sessão principal continua no Claude.

No PowerShell:

```powershell
$env:ANTHROPIC_BASE_URL = 'http://127.0.0.1:8787'
claude
```

Use `ROUTER_DRY_RUN=true` para registrar a decisão sem trocar o modelo. `ROUTER_DEBUG=true` escreve eventos estruturados em stderr. Veja as variáveis completas em [local-development.md](docs/local-development.md).

## Verificação

```bash
npm test
```

Os testes cobrem regras, política, parsing do classificador, sessão/turno e o fluxo de proxy com tool results. Para a validação manual com o CLI, siga [local-development.md](docs/local-development.md).

## Documentação

- [Arquitetura](docs/architecture.md)
- [Política de roteamento](docs/routing-policy.md)
- [Observações do protocolo do Claude Code](docs/claude-code-protocol-observations.md)
- [Desenvolvimento e validação local](docs/local-development.md)
- [Limitações](docs/limitations.md)
- [ADR: pinagem de provider para subagents](docs/adr/0002-provider-pinning-for-subagents.md)
- [ADR: roteamento multi-provider por tiers](docs/adr/0003-tiered-multi-provider-routing.md)
