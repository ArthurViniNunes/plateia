# Registros de Decisões Arquiteturais — Plateia

Este diretório reúne os Architecture Decision Records (ADRs) do Plateia. O objetivo não é apenas registrar o resultado das escolhas, mas tornar explícito o raciocínio empregado: contexto, alternativas descartadas, custos aceitos, riscos e condições que podem justificar uma revisão futura.

## Convenções

- Os ADRs são numerados sequencialmente e não têm seu número reutilizado.
- Uma decisão aceita não é reescrita para esconder mudanças posteriores. Quando necessário, um novo ADR substitui o anterior e referencia a decisão substituída.
- Decisões ainda não tomadas não são apresentadas como concluídas.
- Detalhes reversíveis de implementação permanecem no código; escolhas com impacto estrutural, operacional ou relevante para o domínio são registradas aqui.

## Status possíveis

- **Proposto:** em discussão e ainda não adotado.
- **Aceito:** adotado pelo projeto.
- **Substituído:** trocado por um ADR posterior.
- **Rejeitado:** avaliado, mas não adotado.

## Índice

| ADR                                                              | Decisão                                               | Status |
| ---------------------------------------------------------------- | ----------------------------------------------------- | ------ |
| [0001](./0001-adotar-monorepo-typescript.md)                     | Adotar monorepo com TypeScript ponta a ponta          | Aceito |
| [0002](./0002-adotar-postgresql-prisma-e-docker-compose.md)      | Adotar PostgreSQL, Prisma e Docker Compose            | Aceito |
| [0003](./0003-adotar-tdd-e-estrategia-de-testes.md)              | Adotar TDD e uma estratégia de testes em camadas      | Aceito |
| [0004](./0004-modelar-autenticacao-por-papeis.md)                | Modelar autenticação com três papéis                  | Aceito |
| [0005](./0005-modelar-eventos-com-assentos-numerados.md)         | Modelar eventos com assentos numerados                | Aceito |
| [0006](./0006-bloquear-assentos-por-dez-minutos.md)              | Bloquear assentos por dez minutos                     | Aceito |
| [0007](./0007-usar-ticketmaster-sem-catalogo-de-contingencia.md) | Usar Ticketmaster sem catálogo de contingência        | Aceito |
| [0008](./0008-adotar-mui-com-identidade-editorial.md)            | Adotar MUI com identidade editorial própria           | Aceito |
| [0009](./0009-validar-configuracao-e-falhar-rapidamente.md)      | Validar configuração e falhar rapidamente             | Aceito |
| [0010](./0010-adotar-jwt-e-bcrypt-na-autenticacao.md)            | Adotar JWT e bcrypt na autenticação                   | Aceito |
| [0011](./0011-modelar-eventos-e-integrar-ticketmaster.md)        | Modelar eventos e integrar o catálogo da Ticketmaster | Aceito |
| [0012](./0012-simular-pagamento-e-emitir-ingressos.md)           | Simular pagamentos e emitir ingressos compartilháveis | Aceito |

## Decisões ainda pendentes

Os temas abaixo exigem decisão própria antes de serem implementados:

- mecanismo de autenticação da sessão e armazenamento seguro de credenciais;
- estratégia criptográfica do código do ingresso e do link compartilhável;
- mecanismo exato de concorrência e expiração das reservas no PostgreSQL;
- estratégia de deploy e execução das migrações em produção;
- política de observabilidade, logs e tratamento global de erros.

## Como adicionar um ADR

1. Copiar a estrutura de um registro existente.
2. Usar o próximo número sequencial.
3. Descrever o problema antes de defender a solução.
4. Registrar alternativas reais, inclusive a opção de não agir.
5. Explicitar consequências negativas; toda decisão relevante tem algum custo.
6. Definir gatilhos concretos que justificariam reconsiderar a escolha.
