# ADR 0002 — Adotar PostgreSQL, Prisma e Docker Compose

- **Status:** Aceito
- **Data:** 2026-08-10
- **Responsável pela decisão:** Arthur Vinicius Carneiro Nunes

## Contexto

O Plateia precisa armazenar usuários, eventos, mapas de assentos, reservas, pagamentos simulados e ingressos. A regra mais sensível é impedir que o mesmo assento seja vendido duas vezes, inclusive quando requisições concorrentes ocorrerem. O ambiente também precisa ser reproduzível para o avaliador e permitir testes de integração sem contaminar os dados de desenvolvimento.

## Forças de decisão

- integridade transacional e suporte consistente à concorrência;
- restrições de unicidade e relacionamentos explícitos;
- migrações versionadas e dados semeados;
- ambiente local reproduzível;
- banco de testes isolado do banco de desenvolvimento;
- tempo limitado para implementação e documentação.

## Alternativas consideradas

### SQLite

Reduz a configuração inicial, mas não representa adequadamente o comportamento concorrente e operacional esperado de PostgreSQL. Testes poderiam passar localmente sem validar as mesmas garantias do ambiente real.

### PostgreSQL com SQL direto e `node-postgres`

Oferece controle completo e reduz abstrações. Em contrapartida, exige mais código para mapeamento, migrações e consistência dos tipos no prazo disponível.

### Outros ORMs

Drizzle e Sequelize são alternativas válidas. Prisma foi escolhido pela legibilidade do schema, geração de cliente tipado, migrações e facilidade de leitura por quem avalia o projeto.

### Banco remoto compartilhado

Evita instalação local, mas adiciona dependência de rede, credenciais e risco de interferência entre desenvolvimento e testes.

## Decisão

Usar PostgreSQL como banco relacional e Prisma como camada de acesso e migração. Executar localmente o PostgreSQL com Docker Compose e manter bancos separados para desenvolvimento e testes.

O banco será a fonte autoritativa para integridade de assentos e ingressos. Validações em memória ou no front-end podem melhorar a experiência, mas não substituirão restrições e transações no banco.

## Consequências positivas

- comportamento local próximo ao ambiente publicado;
- schema e migrações ficam versionados;
- relações e restrições são visíveis para o avaliador;
- testes de integração exercitam um banco real;
- o ambiente pode ser iniciado com comandos documentados.

## Consequências negativas e riscos

- Docker aumenta os requisitos de ambiente;
- Prisma adiciona geração de cliente e etapas de migração;
- testes com banco real são mais lentos que testes puramente unitários;
- separar bancos não elimina a necessidade de limpar os dados entre testes;
- uma configuração incorreta pode apontar testes para o banco de desenvolvimento.

## Medidas de mitigação

- fornecer `.env.example` sem segredos;
- usar URLs distintas para desenvolvimento e testes;
- validar a variável de ambiente antes de executar operações destrutivas de teste;
- documentar inicialização, migração, seed e encerramento dos contêineres;
- concentrar testes de regras puras fora do banco e usar integração onde a persistência é parte do comportamento.

## Gatilhos para reconsideração

- deploy escolhido não oferecer PostgreSQL compatível;
- volume ou padrão de acesso exigir outra estratégia de persistência;
- limitações comprovadas do Prisma impedirem uma garantia necessária de concorrência;
- tempo dos testes de integração inviabilizar o ciclo de desenvolvimento.
