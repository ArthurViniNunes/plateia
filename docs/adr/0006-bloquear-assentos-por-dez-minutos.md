# ADR 0006 — Bloquear assentos por dez minutos

- **Status:** Aceito
- **Data:** 2026-08-10
- **Última atualização:** 2026-08-11
- **Responsável pela decisão:** Arthur Vinicius Carneiro Nunes

## Contexto

Entre a seleção dos assentos e a conclusão do pagamento existe um intervalo em que outros clientes não devem conseguir reservar os mesmos lugares.

Marcar um assento como vendido durante a seleção poderia reter estoque indefinidamente após o abandono da compra. Por outro lado, aguardar a confirmação do pagamento sem bloquear o lugar permitiria que diferentes clientes avançassem simultaneamente com o mesmo assento.

A garantia precisa permanecer correta mesmo quando duas requisições chegarem quase ao mesmo tempo. Uma consulta seguida de uma gravação sem coordenação transacional não seria suficiente, pois ambas poderiam observar o assento como disponível antes de qualquer uma persistir o bloqueio.

O PostgreSQL será a fonte autoritativa da disponibilidade. O cronômetro exibido no navegador terá função apenas informativa.

## Forças de decisão

- impedir a reserva ou venda duplicada sob concorrência;
- oferecer tempo suficiente para concluir o pagamento simulado;
- liberar estoque abandonado sem intervenção manual;
- manter o PostgreSQL como fonte autoritativa;
- preservar o valor cobrado no momento da reserva;
- evitar dependência de processos agendados no MVP;
- tornar o comportamento previsível, reproduzível e testável;
- limitar a complexidade dentro do prazo do desafio.

## Alternativas consideradas

### Ocupar somente depois do pagamento

Simplificaria o estado intermediário, mas permitiria que múltiplos clientes iniciassem o checkout com o mesmo assento. O conflito seria percebido apenas ao final da jornada, depois de o cliente acreditar que possuía o lugar.

### Bloqueio sem expiração

Evitaria concorrência durante o checkout, mas exigiria cancelamento manual e causaria perda permanente de disponibilidade quando uma compra fosse abandonada.

### Bloqueio de cinco ou quinze minutos

Cinco minutos poderia ser insuficiente para revisar a compra e concluir o pagamento. Quinze minutos prolongaria desnecessariamente a retenção do estoque. Dez minutos foi escolhido como equilíbrio para o fluxo simulado, e não como regra universal de negócio.

### Estado de disponibilidade persistido diretamente no assento

Foi descartado porque a disponibilidade não é uma propriedade permanente do lugar. Ela depende de reservas temporárias, pagamentos, expirações e, posteriormente, ingressos emitidos.

### Verificação sem bloqueio pessimista

Consultar a disponibilidade e criar a reserva em operações independentes permitiria condições de corrida. Duas transações poderiam observar simultaneamente o mesmo assento como livre.

### Utilizar apenas a restrição de unicidade

A unicidade impediria a persistência duplicada, mas deixaria o controle concorrente dependente da captura de uma exceção do banco. O bloqueio explícito torna a intenção do domínio mais clara e permite validar os assentos de forma atômica antes da criação da reserva.

### Processo agendado para liberar reservas

Um cron job poderia realizar limpeza periódica, mas adicionaria infraestrutura e não poderia ser a única garantia de expiração. Uma reserva vencida precisa ser reconhecida durante a própria operação crítica, mesmo que nenhuma rotina de limpeza tenha sido executada.

## Decisão

### Contrato HTTP

A criação da reserva utilizará:

`POST /api/events/:eventId/reservations`

A rota exigirá autenticação e será restrita a usuários com o papel `CUSTOMER`.

O corpo conterá exclusivamente `seatIds`, com entre um e quatro UUIDs distintos. O cliente não enviará preço, total, prazo de expiração ou estado da reserva.

Dados malformados, lista vazia, mais de quatro assentos ou identificadores repetidos responderão `400 Bad Request`, com o código `VALIDATION_ERROR`.

Evento inexistente, identificador malformado, evento não publicado ou evento cuja sessão já tenha ocorrido responderá `404 Not Found`, com o código `EVENT_NOT_FOUND`.

Quando algum assento não existir, pertencer a outro evento, estiver bloqueado ou já tiver sido vendido, a requisição responderá `409 Conflict`, com o código `SEATS_UNAVAILABLE`.

A resposta não identificará qual lugar provocou o conflito, evitando expor parcialmente o estado da seleção e mantendo o comportamento atômico.

Em caso de sucesso, a API responderá `201 Created` com:

- identificador da reserva;
- identificador do evento;
- estado `PENDING`;
- instante de expiração;
- total em centavos;
- assentos ordenados por fileira e número;
- preço capturado para cada assento.

### Limite e duração

Cada reserva conterá entre um e quatro assentos.

O bloqueio terá duração de dez minutos, calculada exclusivamente pelo servidor a partir do instante de criação. Os instantes serão armazenados em UTC.

O navegador poderá exibir uma contagem regressiva, mas não terá autoridade para prorrogar, concluir ou validar a reserva.

### Modelagem

A entidade `Reservation` armazenará:

- identificador UUID;
- cliente;
- evento;
- estado;
- instante de expiração;
- total em centavos;
- datas de criação e atualização.

A entidade associativa `ReservationSeat` armazenará:

- reserva;
- assento;
- preço em centavos capturado no momento da reserva;
- data de criação.

O preço será registrado em cada item para preservar o valor apresentado ao cliente, mesmo que o preço do evento seja alterado posteriormente. O total será calculado pelo servidor pela soma dos itens e nunca será aceito do cliente.

As reservas utilizarão os estados:

- `PENDING`;
- `PAID`;
- `REJECTED`;
- `EXPIRED`.

Uma reserva recém-criada começará em `PENDING`.

O pagamento aprovado alterará a reserva para `PAID` e manterá os vínculos com os assentos, representando sua ocupação definitiva.

O pagamento recusado alterará a reserva para `REJECTED` e removerá seus vínculos com os assentos.

Uma reserva vencida será alterada para `EXPIRED`, e seus vínculos também serão removidos.

A reserva histórica será preservada mesmo quando seus vínculos forem removidos.

### Garantia de exclusividade

`reservation_seats.seat_id` possuirá uma restrição de unicidade.

Enquanto existir um vínculo:

- uma reserva `PENDING` representará um bloqueio ativo;
- uma reserva `PAID` representará um assento vendido.

Reservas `REJECTED` ou `EXPIRED` não manterão vínculos com os assentos, permitindo que eles voltem a ser selecionados.

### Estratégia transacional

A criação será executada em uma única transação no PostgreSQL.

A transação:

1. confirmará que o evento está publicado e ainda ocorrerá no futuro;
2. ordenará os identificadores recebidos;
3. bloqueará as linhas dos assentos com `SELECT ... FOR UPDATE`;
4. verificará se todos existem e pertencem ao evento solicitado;
5. reconhecerá e encerrará reservas vencidas relacionadas aos assentos;
6. verificará se algum vínculo ativo permanece;
7. criará a reserva e seus itens atomicamente.

Os identificadores serão ordenados antes do bloqueio para reduzir a possibilidade de deadlocks quando requisições concorrentes selecionarem conjuntos sobrepostos em ordens diferentes.

O bloqueio pessimista serializará as tentativas concorrentes sobre os mesmos assentos. Depois que a primeira transação concluir, a seguinte observará o vínculo persistido e responderá com conflito.

A restrição única permanecerá como uma proteção adicional no banco.

### Expiração preguiçosa

Não haverá cron job obrigatório no MVP.

A expiração será reconhecida durante operações críticas que dependam da disponibilidade. Ao tentar reservar um assento associado a uma reserva `PENDING` vencida, a aplicação:

1. removerá os vínculos da reserva vencida;
2. alterará seu estado para `EXPIRED`;
3. permitirá que a nova reserva prossiga na mesma transação.

Assim, a correção da regra não dependerá de uma rotina periódica. Uma limpeza assíncrona poderá ser adicionada posteriormente apenas como otimização operacional.

### Estratégia de testes

Os testes utilizarão o PostgreSQL exclusivo de testes.

Serão verificados:

- bloqueio de um ou mais assentos;
- cálculo do prazo de dez minutos;
- cálculo do total no servidor;
- snapshot do preço por assento;
- ordenação por fileira e número;
- rejeição de lista vazia;
- rejeição de mais de quatro assentos;
- rejeição de identificadores repetidos;
- conflito com assento já bloqueado;
- duas tentativas concorrentes para o mesmo assento;
- expiração de uma reserva anterior;
- liberação do lugar vencido para uma nova reserva.

O teste concorrente deverá demonstrar que, entre duas tentativas simultâneas para o mesmo lugar, somente uma responde `201 Created`, enquanto a outra responde `409 Conflict`.

Os arquivos que compartilham o banco de testes continuarão sendo executados sequencialmente. A limpeza relacional centralizada removerá reservas antes de eventos e usuários.

A consulta pública do mapa classificará cada assento como:

- `AVAILABLE`, quando puder ser selecionado;
- `BLOCKED`, quando pertencer a uma reserva `PENDING` ainda não expirada;
- `SOLD`, quando já possuir ingresso emitido.

Reservas pendentes expiradas não tornarão o assento indisponível, mesmo que a limpeza dos registros ainda não tenha ocorrido.

No front-end, assentos bloqueados e vendidos serão apresentados com estados visuais distintos e permanecerão desabilitados. Enquanto o mapa estiver aberto, sua disponibilidade será atualizada a cada dez segundos. Se um conflito de concorrência ainda ocorrer entre duas atualizações, a resposta `409 Conflict` provocará uma atualização imediata do mapa, removerá da seleção os lugares que deixaram de estar disponíveis e orientará o cliente a escolher novamente.

Essa atualização periódica reduz a defasagem visual, mas não substitui a validação transacional da API. O banco de dados permanece como fonte autoritativa para impedir que dois clientes reservem o mesmo assento.

## Consequências positivas

- impede reservas simultâneas do mesmo assento;
- reduz conflitos tardios no checkout;
- mantém a garantia principal no banco;
- estoque abandonado retorna à disponibilidade;
- a expiração não depende de cron job;
- o valor da compra permanece historicamente consistente;
- a operação é atômica para todos os assentos selecionados;
- o limite de quatro lugares reduz contenção e abuso;
- o comportamento concorrente possui comprovação automatizada.

## Consequências negativas e riscos

- a solução introduz estado temporário e dependência de tempo;
- o SQL de bloqueio cria uma exceção localizada ao uso predominante do Prisma;
- transações concorrentes podem aguardar umas pelas outras;
- a remoção dos vínculos exige consultar o histórico pela reserva, não pelo item removido;
- reservas expiradas que nunca voltarem a ser consultadas permanecerão como `PENDING` até uma operação crítica ou futura rotina de limpeza;
- tentativas repetidas ainda podem ser usadas para reter lugares;
- consultas de disponibilidade precisarão considerar reservas e seus prazos.

## Medidas de mitigação

- armazenar instantes em UTC;
- calcular a expiração no servidor;
- considerar vencimentos em todas as operações críticas;
- ordenar os identificadores antes de bloquear as linhas;
- manter restrição única como proteção adicional;
- testar tentativas concorrentes para o mesmo assento;
- limitar a quantidade por reserva;
- não expor qual assento causou um conflito;
- avaliar rate limiting caso retenção abusiva se torne relevante;
- considerar limpeza periódica apenas como otimização futura.

## Gatilhos para reconsideração

- dados reais indicarem abandono elevado ou prazo insuficiente;
- integração com provedor de pagamento exigir outra duração;
- alta concorrência demandar filas, cache distribuído ou outra estratégia;
- esperas transacionais prejudicarem a experiência;
- regras comerciais permitirem extensão controlada;
- o volume de reservas expiradas justificar um processo periódico de limpeza.
