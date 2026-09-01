# ADR 0003: Roteamento multi-provider por tiers de capacidade

## Contexto

O Smart Model Routing começou com poucos IDs lógicos (`haiku`, `sonnet`, `opus` e `deepseek`) e um gateway Anthropic. Essa estrutura separa parte da análise de tarefa da política, mas ainda acopla a política a modelos concretos e coloca regras de provider no gateway.

O produto deve poder selecionar entre modelos de múltiplos providers por custo, latência, capacidade, compatibilidade de protocolo e risco da tarefa. Modelos e preços mudam com frequência; a política não pode depender de nomes específicos de modelos.

## Decisão

Introduzir quatro tiers independentes de provider:

| Tier | Objetivo |
| --- | --- |
| `LOW` | Menor custo e latência aceitáveis para consultas e exploração simples |
| `STANDARD` | Melhor equilíbrio para trabalho diário de engenharia e implementações isoladas de risco controlado |
| `HIGH` | Raciocínio, implementação e agentes complexos |
| `CRITICAL` | Mudanças de alto impacto, segurança, arquitetura e decisões irreversíveis |

A arquitetura será dividida em quatro contratos:

```text
TaskAnalyzer -> TaskProfile
PolicyEngine -> RouteIntent
ModelResolver -> ModelCandidate
ProviderAdapter -> chamada e resposta do provider
```

- `TaskAnalyzer` extrai complexidade, risco, tipo de tarefa, contexto, ferramentas e modalidades necessárias. Pode combinar regras determinísticas e classificação opcional.
- `PolicyEngine` escolhe somente o tier, requisitos mínimos, orçamento, política de fallback e escopo de stickiness. Não conhece nomes de providers nem modelos.
- `ModelResolver` consulta um registro configurável de modelos habilitados e escolhe um candidato compatível no tier, considerando capacidades, custo, saúde e latência observada.
- `ProviderAdapter` contém a conversão de protocolo e autenticação de cada provider: Anthropic nativo, Anthropic-compatível ou OpenAI-compatível.

Cada sessão principal ou subagent fica pinado ao candidato escolhido durante todo o ciclo de ferramentas. Uma troca de provider no meio da conversa é proibida; fallback cria uma nova execução ou retorna erro explícito.

No despacho de subagents, o tipo de agente representa o escopo de ferramentas (`Explore` é somente leitura; `general-purpose` pode executar). O gateway passa esse escopo ao `ModelResolver`; ele não escolhe DeepSeek pela palavra "DeepSeek" no prompt. Inicialmente, `deepseek-v4-flash-worker` é elegível para `STANDARD` somente em subagents de execução isolada. Trabalho de alto risco ou crítico sobe de tier e não é elegível para esse candidato.

## Catálogo inicial proposto

| Tier | Candidatos iniciais | Estado |
| --- | --- | --- |
| `LOW` | DeepSeek V4 Flash, GLM-5.3-Flash/GLM-4.7-Flash, Haiku | DeepSeek já integrado; GLM e Haiku entram após adapters/evals |
| `STANDARD` | GLM-4.7, DeepSeek V4 Pro, Sonnet | Planejado |
| `HIGH` | Sonnet, Kimi K2.7 Code/Kimi K3, DeepSeek V4 Pro | Planejado |
| `CRITICAL` | Opus como âncora, candidatos promovidos somente após eval | Planejado |

Nenhum modelo é ativado apenas por preço ou benchmark do fornecedor. Para ser habilitado, precisa ter adapter validado, credencial configurada, teste de compatibilidade de ferramentas/streaming e resultado mínimo no conjunto de evals local.

## Consequências

- Adicionar um provider não exige alterar o `PolicyEngine`.
- Preço e capacidade passam a ser dados versionados no `ModelRegistry`, não constantes espalhadas no gateway.
- Logs devem registrar tier escolhido, candidato, provider, razão, fallback e métricas de custo/latência.
- O rollout será por feature flag e em modo shadow antes de tornar um novo candidato elegível para produção.
- ADR 0001 e ADR 0002 continuam válidas para a integração atual do DeepSeek, mas sua implementação migra gradualmente para os novos contratos.
