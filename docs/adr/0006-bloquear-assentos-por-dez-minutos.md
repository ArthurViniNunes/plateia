# ADR 0006 — Bloquear assentos por dez minutos

- **Status:** Aceito
- **Data:** 2026-08-10
- **Responsável pela decisão:** Arthur Vinicius Carneiro Nunes

## Contexto

Entre selecionar um assento e concluir o pagamento existe um intervalo em que outros clientes não devem conseguir comprar o mesmo lugar. Marcar o assento como vendido na seleção poderia prender estoque após abandono; esperar o pagamento sem qualquer bloqueio permitiria que duas pessoas avançassem com o mesmo assento.

## Forças de decisão

- impedir venda duplicada sob concorrência;
- oferecer tempo suficiente para concluir um pagamento simulado;
- liberar automaticamente estoque abandonado;
- manter o banco como fonte autoritativa;
- tornar o comportamento previsível e testável.

## Alternativas consideradas

### Ocupar somente depois do pagamento

Simplifica o estado intermediário, mas permite que múltiplos clientes iniciem checkout com o mesmo assento e transfere o conflito para o final da jornada.

### Bloqueio sem expiração

Evita concorrência durante o checkout, mas exige cancelamento manual e causa perda permanente de disponibilidade em abandonos.

### Bloqueio de cinco ou quinze minutos

Cinco minutos pode ser curto para leitura e preenchimento; quinze prolonga retenção de estoque. Dez minutos foi escolhido como equilíbrio para o fluxo simulado, não como verdade universal de negócio.

## Decisão

Ao iniciar uma reserva, bloquear atomicamente até quatro assentos por dez minutos. Durante o bloqueio, esses assentos não poderão ser reservados por outro cliente. Pagamento aprovado transforma a reserva em compra e torna a ocupação definitiva. Pagamento recusado ou expiração devolve os assentos à disponibilidade.

A API e o banco, não o cronômetro exibido no navegador, determinarão se a reserva ainda é válida. A técnica exata de concorrência e limpeza será decidida durante a modelagem do schema e registrada separadamente se tiver impacto arquitetural.

## Consequências positivas

- reduz conflitos tardios no checkout;
- estoque abandonado retorna automaticamente;
- a regra pode ser testada com relógio controlado;
- o limite de quatro lugares restringe contenção e abuso no MVP.

## Consequências negativas e riscos

- introduz estado temporário e dependência de tempo;
- relógios, fusos e comparações incorretas podem manter ou liberar assentos indevidamente;
- uma rotina de limpeza atrasada não pode ser a única forma de reconhecer expiração;
- concorrência exige transação ou mecanismo equivalente no banco;
- tentativas repetidas podem ser usadas para reter lugares.

## Medidas de mitigação

- armazenar instantes em UTC;
- considerar a expiração no momento de cada operação crítica, mesmo que exista limpeza periódica;
- usar relógio injetável nos testes de domínio;
- testar duas tentativas concorrentes para o mesmo assento;
- limitar quantidade por reserva e avaliar limites adicionais se houver abuso.

## Gatilhos para reconsideração

- dados reais mostrarem abandono elevado ou tempo insuficiente;
- integração com provedor de pagamento exigir outro prazo;
- alta concorrência demandar fila, cache distribuído ou estratégia diferente;
- regras comerciais permitirem extensão controlada da reserva.
