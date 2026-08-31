# Limitações do MVP

- A API Messages é stateless. O modo padrão usa o hook oficial `UserPromptSubmit` para delimitar o turno humano; sem o hook, o gateway conserva o modelo já selecionado. O modo `heuristic` existe somente para diagnóstico e não deve ser usado em produção.
- DeepSeek é suportado somente pelo subagent customizado `deepseek-explore`, que fixa o modelo no frontmatter; o gateway não tenta detectar ou trocar provider após o agent ter iniciado.
- O subagent integrado `Explore` continua usando a configuração de modelo padrão do Claude Code. O CLI não documenta uma variável de ambiente para mudar somente o modelo dele.
- O classificador é uma interface injetável; conectá-lo a uma chamada Haiku autenticada deve ser feito com cuidado para evitar roteamento recursivo e fica desativável por configuração.
- Não há escalonamento semântico/retry por qualidade, persistência de sessão, banco de dados, UI, telemetria remota ou cálculo de custo.
- O processo escuta somente em `127.0.0.1`; isso é intencional para o MVP local.
