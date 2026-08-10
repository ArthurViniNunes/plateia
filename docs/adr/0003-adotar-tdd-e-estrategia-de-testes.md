# ADR 0003 — Adotar TDD e uma estratégia de testes em camadas

- **Status:** Aceito
- **Data:** 2026-08-10
- **Responsável pela decisão:** Arthur Vinicius Carneiro Nunes

## Contexto

O desafio reúne regras com impacto financeiro e operacional, como expiração de reservas, concorrência por assentos, emissão de ingressos e prevenção de uso duplicado. Implementar todas as telas antes de validar essas regras produziria feedback tardio. Ao mesmo tempo, tentar testar cada detalhe interno aumentaria o custo de mudança e reduziria a velocidade de entrega.

## Forças de decisão

- transformar requisitos em comportamentos verificáveis;
- obter feedback rápido durante um prazo curto;
- proteger regras críticas contra regressão;
- manter testes legíveis como documentação executável;
- evitar acoplamento dos testes à estrutura interna do código.

## Alternativas consideradas

### Testar somente ao final

Pode acelerar os primeiros minutos de implementação, mas concentra descoberta de defeitos quando o custo de correção é maior e o prazo está mais próximo.

### Cobertura unitária total

Uma meta indiscriminada incentiva testes de detalhes triviais e não garante que banco, HTTP e interface funcionem juntos.

### Apenas testes ponta a ponta

Validam jornadas reais, porém são mais lentos, mais frágeis e oferecem diagnóstico menos preciso quando uma regra falha.

## Decisão

Adotar ciclos TDD de teste vermelho, implementação mínima, teste verde e refatoração. Priorizar comportamento observável em vez de detalhes privados.

Usar:

- Vitest como executor comum;
- Supertest para contratos HTTP da API;
- React Testing Library para comportamento da interface;
- PostgreSQL separado para testes em que persistência, restrições ou transações façam parte da regra;
- testes unitários para regras puras;
- poucos testes de jornada completa para os fluxos essenciais.

O primeiro contrato criado foi `GET /health`, com resposta determinística `{ "status": "ok" }`. O teste foi escrito antes da implementação; sua falha foi inferida pela ausência do módulo importado, sem captura de uma execução vermelha, para acelerar o bootstrap. Os ciclos seguintes devem executar e observar o vermelho sempre que possível.

## Consequências positivas

- critérios de aceite ficam explícitos antes da solução;
- refatorações possuem rede de segurança;
- falhas de concorrência e validação podem ser reproduzidas;
- o histórico de commits pode refletir a evolução das regras;
- o avaliador consegue relacionar requisito, teste e implementação.

## Consequências negativas e riscos

- há custo inicial de infraestrutura;
- mocks excessivos podem produzir confiança falsa;
- testes de integração exigem isolamento e limpeza cuidadosa;
- um TDD mecânico pode fragmentar demais o design;
- o prazo pode incentivar pular a observação do estado vermelho.

## Medidas de mitigação

- testar primeiro riscos de domínio e contratos públicos;
- simular apenas fronteiras externas, como Ticketmaster;
- usar o banco real nos comportamentos que dependem dele;
- registrar exceções conscientes ao ciclo normal;
- não usar percentual de cobertura como substituto de uma análise de risco.

## Gatilhos para reconsideração

- testes deixarem de detectar defeitos relevantes;
- suíte se tornar lenta a ponto de impedir ciclos curtos;
- mudanças frequentes quebrarem testes sem alterar comportamento;
- uma ferramenta escolhida impedir testes necessários no ambiente de CI.
