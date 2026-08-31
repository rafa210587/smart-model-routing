# Política de roteamento

O objetivo é escolher o Claude mais barato que tenha capacidade confiável para o trabalho.

| Classe | Modelo | Exemplos |
| --- | --- | --- |
| Busca, referência, explicação ou resumo simples de baixo risco | Haiku | `find usages`, `resuma este arquivo` |
| Implementação, testes, debugging e refactor comuns | Sonnet | `implemente retry`, `corrija esse bug` |
| Arquitetura complexa, race condition distribuída ou raciocínio de alto risco | Opus | `analise consistência distribuída` |

Os limiares `HAIKU_MAX_COMPLEXITY` (0.30) e `OPUS_MIN_COMPLEXITY` (0.80) são configuráveis. Entre Haiku e Sonnet a política escolhe Sonnet; entre Sonnet e Opus ela também escolhe Sonnet, exceto quando os sinais são fortes.

O classificador Haiku é opcional e não executa a tarefa. A resposta estruturada é validada; a policy pode rejeitar uma recomendação barata demais. Não há escalonamento automático baseado na qualidade da resposta neste MVP.
