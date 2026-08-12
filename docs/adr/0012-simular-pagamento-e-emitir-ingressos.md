# ADR 0012 — Simular pagamentos e emitir ingressos compartilháveis

- **Status:** Aceito
- **Data:** 2026-08-12
- **Responsável pela decisão:** Arthur Vinicius Carneiro Nunes

## Contexto

Depois de reservar os assentos, o cliente precisa concluir um pagamento simulado. Uma aprovação deve tornar a ocupação definitiva e emitir um ingresso para cada lugar. Uma recusa ou expiração deve liberar os assentos.

O desafio não exige transação financeira real, mas exige confirmação e recusa, ingresso com QR, compartilhamento por link e validação posterior pela portaria.

O fluxo precisa impedir que requisições concorrentes processem a mesma reserva mais de uma vez ou emitam ingressos duplicados.

O ingresso compartilhado não poderá expor dados pessoais do cliente. Seu código também não poderá ser previsível ou fabricado a partir de identificadores sequenciais.

## Forças de decisão

- concluir o fluxo de compra sem integração financeira real;
- impedir processamento duplicado;
- emitir exatamente um ingresso por assento;
- preservar a ocupação após aprovação;
- liberar os lugares após recusa ou expiração;
- produzir códigos impraticáveis de adivinhar;
- permitir compartilhamento sem expor dados pessoais;
- manter a solução pequena o suficiente para o prazo do MVP;
- preparar a validação posterior pela portaria.

## Alternativas consideradas

### Integrar um provedor de pagamento real em ambiente de testes

Ofereceria uma simulação mais próxima da produção, mas adicionaria credenciais, webhooks, estados assíncronos e dependência externa. O desafio permite pagamento simulado, e esse acréscimo não seria proporcional ao prazo.

### Determinar o resultado aleatoriamente

Reduziria a entrada necessária, mas tornaria demonstrações e testes não determinísticos. O cliente da API informará explicitamente `APPROVED` ou `DECLINED`.

### Emitir um único ingresso para toda a reserva

Simplificaria a persistência, mas impediria compartilhar ou validar assentos individualmente. Será emitido um ingresso para cada lugar.

### Utilizar o UUID do ingresso como código

Um UUID aleatório seria razoavelmente seguro, mas um código dedicado separa a identidade interna do recurso da credencial apresentada no QR e permite evolução independente.

### Assinar um JWT para cada ingresso

Garantiria integridade criptográfica sem consulta prévia, porém adicionaria expiração, versionamento de claims e gerenciamento de assinatura a um fluxo que continuará consultando o banco para verificar uso e cancelamento.

### Armazenar somente o hash do código

Reduziria o impacto de uma leitura indevida do banco, mas impediria recuperar o código para “Meus ingressos” sem armazenar outra representação ou criar um mecanismo adicional. No MVP, o código opaco será persistido diretamente, com acesso restrito pelas regras da API.

### Inserir todos os dados no QR

Permitiria leitura sem rede, mas duplicaria informações, dificultaria invalidação e poderia expor dados. O QR conterá apenas o link com o código opaco.

## Decisão

### Pagamento simulado

O pagamento utilizará:

`POST /api/reservations/:reservationId/payment`

A rota exigirá autenticação e será restrita a usuários `CUSTOMER`.

O corpo aceitará somente:

- `APPROVED`;
- `DECLINED`.

O resultado será informado explicitamente para manter testes e demonstrações determinísticos.

Dados malformados responderão `400 Bad Request`, com o código `VALIDATION_ERROR`.

Reserva inexistente, identificador malformado ou reserva pertencente a outro cliente responderá de forma indistinguível com `404 Not Found` e o código `RESERVATION_NOT_FOUND`.

Uma reserva vencida será alterada para `EXPIRED`, terá seus assentos liberados e responderá `409 Conflict`, com o código `RESERVATION_EXPIRED`.

Reservas que não estejam mais em `PENDING` responderão `409 Conflict`, com o código `RESERVATION_CANNOT_BE_PAID`.

### Pagamento recusado

Quando o resultado for `DECLINED`, a aplicação:

1. bloqueará a reserva;
2. confirmará sua propriedade, estado e validade;
3. removerá os vínculos com os assentos;
4. alterará seu estado para `REJECTED`;
5. responderá `200 OK` com a lista de ingressos vazia.

A reserva continuará persistida para preservar o histórico da tentativa.

### Pagamento aprovado

Quando o resultado for `APPROVED`, a aplicação:

1. bloqueará a reserva;
2. confirmará sua propriedade, estado e validade;
3. emitirá um ingresso para cada assento;
4. alterará a reserva para `PAID`;
5. manterá os vínculos com os assentos;
6. responderá `200 OK` com os ingressos emitidos.

A reserva e os ingressos serão processados na mesma transação.

### Concorrência

A linha da reserva será bloqueada no PostgreSQL com `SELECT ... FOR UPDATE`.

Tentativas concorrentes serão serializadas. Somente a primeira poderá processar uma reserva `PENDING`. Depois da confirmação, as demais observarão o novo estado e responderão com conflito.

O banco também protegerá `tickets.seat_id` com unicidade, garantindo que um assento origine no máximo um ingresso.

A expiração será persistida antes de o erro HTTP ser lançado. A transação retornará um resultado interno, e a camada externa lançará o erro somente depois do commit. Isso evita rollback acidental da mudança para `EXPIRED`.

### Modelagem do ingresso

Cada `Ticket` armazenará:

- identificador UUID;
- reserva;
- cliente;
- evento;
- assento;
- código único;
- instante opcional de utilização;
- datas de criação e atualização.

As referências a reserva, cliente, evento e assento utilizarão exclusão restritiva, preservando o histórico necessário à validação.

Serão criados índices para:

- reserva;
- cliente e data de criação;
- evento.

O assento e o código possuirão restrições de unicidade.

### Código do ingresso

O código será gerado com 32 bytes aleatórios criptograficamente seguros por meio de `crypto.randomBytes()` e convertido para `base64url`.

O espaço de 256 bits torna uma tentativa de adivinhação impraticável no contexto do MVP.

O código será independente do UUID interno e servirá como credencial opaca para:

- o QR;
- o link compartilhável;
- a validação pela portaria.

Mesmo que alguém conheça o formato do endereço, não poderá produzir um ingresso existente sem conhecer um código válido.

### Meus ingressos

A consulta autenticada utilizará:

`GET /api/tickets`

Ela será restrita a clientes e retornará exclusivamente os ingressos pertencentes ao usuário autenticado.

Os ingressos serão ordenados pela data do evento e, dentro da mesma sessão, por fileira e número.

### Compartilhamento público

A consulta compartilhável utilizará:

`GET /api/tickets/:code`

Ela não exigirá autenticação. Qualquer pessoa com o link poderá visualizar o ingresso, conforme definido para o MVP.

A resposta pública não incluirá:

- nome do cliente;
- e-mail;
- identificador do cliente;
- hash de senha;
- dados da reserva que não sejam necessários à apresentação.

Código inexistente responderá `404 Not Found`, com o código `TICKET_NOT_FOUND`.

### QR e caminho compartilhável

A API retornará:

`/tickets/<codigo>`

O front-end combinará esse caminho com sua própria origem e renderizará o endereço completo como QR.

Essa escolha evita acoplar a API ao domínio utilizado no desenvolvimento ou no deploy.

O QR não carregará os dados completos do ingresso. Ao ser aberto ou validado, o código será consultado no banco, permitindo reconhecer uso e cancelamento.

### Estado apresentado

O estado apresentado será calculado a partir do evento e do ingresso:

- evento `CANCELLED` resulta em `CANCELLED`;
- caso contrário, `usedAt` preenchido resulta em `USED`;
- nos demais casos, resulta em `VALID`.

O cancelamento terá precedência sobre a utilização, pois um ingresso de evento cancelado não deverá ser apresentado como utilizável, mesmo que tenha sido validado anteriormente.

Esse estado não será persistido como campo redundante.

## Estratégia de testes

Os testes de pagamento utilizarão o PostgreSQL de testes e cobrirão:

- pagamento aprovado;
- emissão de um ingresso por assento;
- unicidade dos códigos;
- preservação dos vínculos após aprovação;
- pagamento recusado;
- liberação dos assentos após recusa;
- expiração durante o pagamento;
- persistência do estado `EXPIRED`;
- ocultação de reserva pertencente a outro cliente;
- duas tentativas concorrentes para a mesma reserva;
- emissão única sob concorrência.

Os testes de consulta cobrirão:

- listagem exclusiva dos ingressos do cliente;
- consulta pública pelo código;
- ausência de dados pessoais na resposta compartilhada;
- código inexistente;
- estado `USED`;
- estado `CANCELLED`;
- precedência do cancelamento sobre a utilização.

Nenhum teste dependerá de serviço financeiro ou gerador externo de QR.

## Consequências positivas

- conclui o fluxo transacional da compra;
- mantém o pagamento demonstrável e determinístico;
- impede emissão duplicada sob concorrência;
- preserva a ocupação dos lugares pagos;
- libera lugares recusados ou vencidos;
- produz um ingresso individual por assento;
- permite compartilhamento sem autenticação;
- evita exposição de dados pessoais no link;
- permite invalidar o ingresso consultando o banco;
- prepara diretamente o fluxo da portaria.

## Consequências negativas e riscos

- o resultado informado pelo cliente não representa segurança de pagamento real;
- o código é armazenado diretamente no banco;
- qualquer pessoa com o link pode visualizar o ingresso;
- links compartilhados podem ser repassados sem controle;
- a API precisa estar disponível para consulta e validação;
- a geração visual do QR dependerá do front-end;
- não há reemissão ou rotação de código no MVP.

## Medidas de mitigação

- deixar explícito que o pagamento é simulado;
- restringir o processamento ao proprietário da reserva;
- utilizar bloqueio transacional;
- proteger assento e código com unicidade;
- gerar códigos com fonte criptograficamente segura;
- omitir dados pessoais da consulta pública;
- consultar o banco antes de considerar um ingresso válido;
- invalidar ingressos de eventos cancelados;
- impedir utilização duplicada na futura operação da portaria.

## Gatilhos para reconsideração

- adoção de um provedor financeiro real;
- necessidade de webhooks ou conciliação;
- exigência de revogação ou rotação dos códigos;
- necessidade de ocultar também os dados do evento no compartilhamento;
- funcionamento offline da portaria;
- requisitos regulatórios ou antifraude adicionais;
- necessidade de transferir formalmente a titularidade do ingresso.
