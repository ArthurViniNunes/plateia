# ADR 0005 — Modelar eventos com assentos numerados

- **Status:** Aceito
- **Data:** 2026-08-10
- **Responsável pela decisão:** Arthur Vinicius Carneiro Nunes

## Contexto

O desafio permite implementar venda por quantidade, mapa de assentos ou ambos. O Plateia pretende demonstrar uma jornada visual mais rica e uma regra de domínio relevante: selecionar lugares específicos sem permitir venda duplicada. O organizador deve configurar o evento a partir de um item da Ticketmaster e definir data, local, capacidade e preço.

## Forças de decisão

- oferecer seleção visual e inequívoca do lugar;
- demonstrar modelagem e integridade além de um contador de estoque;
- manter configuração compreensível no prazo disponível;
- evitar setores e faixas de preço antes de o fluxo básico estar completo;
- suportar shows ou filmes em locais com assentos numerados.

## Alternativas consideradas

### Estoque apenas por quantidade

É mais simples e adequado a pista, mas reduz a demonstração de concorrência e não atende à direção escolhida para o produto.

### Setores, fileiras e preços distintos

Representa eventos maiores com mais fidelidade, porém amplia formulários, regras de preço, validações e interface antes de existir um fluxo completo.

### Mapa fixo compartilhado por todos os eventos

Reduz configuração, mas associa eventos diferentes a uma capacidade artificial e dificulta representar locais variados.

## Decisão

Cada evento possuirá um mapa próprio, configurado por quantidade de fileiras e assentos por fileira. Os assentos serão identificáveis e terão preço único definido no evento. Um cliente poderá selecionar até quatro assentos em uma mesma compra.

O evento terá os estados `DRAFT`, `PUBLISHED` e `CANCELLED`. Apenas eventos publicados estarão disponíveis para reserva. Ingressos de eventos cancelados permanecerão consultáveis, mas serão inválidos para entrada; não haverá estorno simulado no MVP.

## Consequências positivas

- seleção e ingresso podem exibir um lugar concreto;
- capacidade deriva do mapa e pode ser validada;
- o domínio possui uma unidade clara para reserva e venda;
- preço único reduz ambiguidade no checkout;
- o desenho permite adicionar setores posteriormente.

## Consequências negativas e riscos

- o mapa aumenta o volume de registros e elementos visuais;
- layouts com muitas fileiras exigem cuidado de responsividade e acessibilidade;
- preço único não representa camarotes, setores ou meia-entrada;
- shows exclusivamente de pista não são bem representados;
- alterações no mapa após vendas podem comprometer ingressos existentes.

## Medidas de mitigação

- limitar dimensões do mapa no MVP;
- tornar assentos navegáveis por teclado e acompanhados de legenda textual;
- impedir alterações estruturais incompatíveis após a primeira reserva ou venda;
- documentar pista e setores como evolução, não como funcionalidade incompleta.

## Gatilhos para reconsideração

- necessidade de eventos de pista;
- introdução de setores, lotes ou categorias de preço;
- mapas grandes comprometerem desempenho ou usabilidade;
- integração futura fornecer plantas reais dos locais.
