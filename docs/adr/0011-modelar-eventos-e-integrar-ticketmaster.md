# ADR 0011: Modelar eventos e integrar o catálogo da Ticketmaster

* Status: Aceito
* Data: 2026-08-11

## Contexto

O Plateia permite que organizadores criem eventos com base em um catálogo externo de shows. O desafio admite a utilização da Ticketmaster Discovery API ou da TMDB como fonte desse catálogo.

A Ticketmaster foi escolhida por oferecer dados diretamente relacionados a shows e eventos. O item externo funcionará como referência cultural, enquanto o organizador definirá no Plateia a sessão que será comercializada, incluindo data, horário, local, mapa de assentos e preço.

A dependência externa não deve comprometer os demais fluxos da aplicação. Cadastro, login e consulta a eventos já persistidos deverão continuar disponíveis quando a Ticketmaster estiver indisponível. Entretanto, a criação de um evento dependerá da validação do item externo.

Também será necessário representar assentos numerados individualmente. Essa modelagem permitirá derivar a capacidade real do evento e, posteriormente, impedir que um mesmo lugar seja reservado ou vendido mais de uma vez.

## Decisão

### Provedor externo

A Ticketmaster Discovery API v2 será a única fonte do catálogo externo no MVP.

Não haverá integração com a TMDB, criação manual desvinculada do catálogo ou catálogo local de contingência.

A comunicação com a Ticketmaster será realizada exclusivamente pelo back-end. A chave de acesso nunca será enviada ao navegador nem incluída no código-fonte.

### Configuração da chave

A variável `TICKETMASTER_API_KEY` será opcional durante a inicialização da API.

Essa decisão permite que funcionalidades independentes, como cadastro, login e consulta a eventos já persistidos, permaneçam disponíveis mesmo quando a chave não estiver configurada.

A chave será obrigatória para:

* pesquisar o catálogo externo;
* consultar os detalhes de um item;
* criar um evento com base nesse item.

Quando a chave estiver ausente, as operações dependentes da Ticketmaster serão bloqueadas.

O arquivo `.env.example` documentará a variável sem fornecer um valor real:

```text
TICKETMASTER_API_KEY=
```

### Pesquisa no catálogo

A API do Plateia disponibilizará a seguinte rota:

```http
GET /api/catalog/events?query=<termo>
```

A pesquisa será inicialmente limitada ao Brasil por meio do parâmetro `countryCode=BR` e retornará até 12 eventos por chamada.

O parâmetro `query` será obrigatório, terá os espaços externos removidos e deverá conter entre 2 e 100 caracteres.

Dados inválidos responderão `400 Bad Request`:

```json
{
"error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data"
    }
}
```

A pesquisa será restrita a usuários autenticados com o papel `ORGANIZER`.

Requisições sem autenticação válida responderão `401 Unauthorized`. Usuários autenticados sem o papel necessário receberão `403 Forbidden`:

```json
{
"error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions"
    }
}
```

O back-end retornará somente os campos necessários para a interface:

* ID externo;
* título;
* URL da imagem;
* classificação;
* URL original da Ticketmaster.

A imagem principal será a maior imagem disponível com proporção `16_9`. Caso não exista uma imagem nessa proporção, será utilizada a maior imagem disponível.

A classificação priorizará o segmento informado pela Ticketmaster e utilizará o gênero como alternativa.

A resposta utilizará o envelope:

```json
{
"events": [
    {
    "id": "ticketmaster-event-id",
    "title": "Nome do evento",
    "imageUrl": "https://example.com/image.jpg",
    "classification": "Music",
    "externalUrl": "https://ticketmaster.example/event"
    }
]
}
```

O envelope permitirá adicionar paginação ou metadados futuramente sem alterar o tipo raiz da resposta.

### Limites e timeout

Cada chamada à Ticketmaster terá timeout de cinco segundos.

A integração respeitará os limites oficiais do provedor. Os testes automatizados utilizarão respostas simuladas e não consumirão a cota vinculada à chave real.

### Confirmação durante a criação

Antes de persistir um evento, a aplicação consultará novamente o item pelo ID externo:

```http
GET /discovery/v2/events/{id}
```

A criação somente continuará quando a Ticketmaster confirmar o item solicitado e retornar uma resposta compatível com o contrato esperado.

Essa consulta adicional impedirá a criação de eventos a partir de IDs inventados, resultados desatualizados ou dados manipulados pelo cliente.

### Indisponibilidade da Ticketmaster

Serão tratadas como indisponibilidade:

* chave ausente ou inválida;
* resposta `401`;
* excesso de requisições com resposta `429`;
* respostas `5xx`;
* falha de rede;
* timeout;
* corpo incompatível com o contrato esperado.

Essas situações responderão `503 Service Unavailable`:

```json
{
"error": {
    "code": "TICKETMASTER_UNAVAILABLE",
    "message": "Ticketmaster catalog is unavailable"
    }
}
```

A aplicação não utilizará dados inventados nem catálogo local como fallback.

Uma resposta válida indicando que o item solicitado não existe será tratada separadamente como recurso não encontrado, e não como indisponibilidade geral do provedor.

### Snapshot do catálogo

Ao criar um evento, o Plateia armazenará um snapshot do item externo contendo:

* ID da Ticketmaster;
* título;
* URL da imagem, quando disponível;
* classificação, quando disponível;
* URL original da Ticketmaster, quando disponível;
* data e hora da consulta externa.

O snapshot preservará as informações utilizadas durante a criação, mesmo que a Ticketmaster altere ou remova o item posteriormente.

O mesmo item da Ticketmaster poderá originar mais de um evento no Plateia. Essa decisão permitirá criar sessões distintas a partir da mesma referência externa. Consequentemente, o ID da Ticketmaster será indexado, mas não será único no banco local.

### Dados definidos pelo organizador

O organizador definirá:

* data e horário;
* nome do local;
* endereço;
* cidade;
* estado;
* fileiras;
* quantidade de assentos por fileira;
* preço único dos assentos.

A data e o horário serão recebidos com informação de fuso e armazenados em UTC.

O local será representado pelos campos:

* `venueName`;
* `address`;
* `city`;
* `state`.

Esses dados não precisarão coincidir com o local ou a data informados pela Ticketmaster, pois o catálogo será utilizado como referência para a criação de uma sessão própria no Plateia.

A criação do rascunho exigirá data, local, mapa e preço preenchidos. A publicação repetirá essas validações para impedir que alterações posteriores deixem o evento inconsistente.

### Preço

Todos os assentos de um evento terão o mesmo preço.

Valores monetários serão armazenados como centavos inteiros, evitando cálculos com ponto flutuante.

O preço deverá ser positivo antes da publicação.

### Mapa de assentos

O organizador fornecerá as fileiras e suas respectivas quantidades:

```json
[
    {
    "label": "A",
    "seatCount": 10
    },
    {
    "label": "B",
    "seatCount": 12
    }
]
```

Os rótulos serão aparados e convertidos para letras maiúsculas.

Cada rótulo deverá conter entre 1 e 10 caracteres. Um evento poderá possuir no máximo 26 fileiras, e cada fileira deverá possuir entre 1 e 100 assentos. A capacidade máxima será, portanto, de 2.600 lugares.

Cada assento será persistido individualmente com:

* referência ao evento;
* rótulo da fileira;
* número do assento.

A combinação entre evento, fileira e número será única.

A capacidade não será armazenada como um campo independente. Ela será derivada da quantidade de assentos persistidos, evitando divergências entre a capacidade declarada e o mapa efetivo.

O estado comercial não será armazenado diretamente no assento. Sua disponibilidade será derivada das reservas e dos ingressos associados, que serão modelados posteriormente.

### Propriedade do evento

Todo evento pertencerá a um usuário organizador.

O banco armazenará a referência ao proprietário, enquanto a aplicação verificará se o usuário possui o papel `ORGANIZER`.

Somente o organizador proprietário poderá editar, publicar ou cancelar o evento.

A exclusão de um organizador que possua eventos será bloqueada pelo banco.

### Ciclo de vida

Os eventos utilizarão os estados:

* `DRAFT`;
* `PUBLISHED`;
* `CANCELLED`.

O fluxo permitido será:

```text
DRAFT -> PUBLISHED -> CANCELLED
```

Não haverá retorno de `PUBLISHED` para `DRAFT`.

Somente eventos em `DRAFT` poderão ser editados.

A publicação exigirá:

* item da Ticketmaster previamente validado;
* data futura;
* local preenchido;
* preço positivo;
* pelo menos um assento.

Somente eventos em `PUBLISHED` poderão ser cancelados.

Eventos não poderão ser excluídos por meio da API no MVP. Essa decisão preservará o histórico necessário para reservas, ingressos e validações futuras.

Caso um evento seja removido diretamente durante testes ou manutenção, seus assentos serão excluídos em cascata, pois pertencem ao agregado do evento.

## Estrutura conceitual

### Event

O evento armazenará:

* identificador UUID;
* organizador proprietário;
* ID externo da Ticketmaster;
* título;
* URL opcional da imagem;
* classificação opcional;
* URL externa opcional;
* data da consulta ao catálogo;
* data e horário da sessão;
* dados do local;
* preço em centavos;
* estado;
* datas de criação e atualização.

Serão criados índices para:

* organizador;
* estado e data da sessão;
* ID externo da Ticketmaster.

### Seat

O assento armazenará:

* identificador UUID;
* evento;
* rótulo da fileira;
* número;
* datas de criação e atualização.

A combinação entre evento, fileira e número será protegida por uma restrição de unicidade.

## Estratégia de testes

Os testes da integração com a Ticketmaster utilizarão transporte injetável e respostas HTTP simuladas.

Serão cobertos:

* pesquisa bem-sucedida;
* normalização do termo pesquisado;
* seleção da imagem principal;
* mapeamento da classificação;
* item encontrado por ID;
* chave ausente;
* resposta não autorizada;
* limite de requisições;
* indisponibilidade externa;
* timeout;
* resposta malformada;
* item inexistente.

Os testes da rota de catálogo também cobrirão:

* consulta realizada por organizador;
* autenticação ausente;
* papel sem permissão;
* parâmetro inválido;
* tradução da indisponibilidade externa para `503`.

Os testes de criação de evento utilizarão o PostgreSQL exclusivo de testes e uma implementação simulada do catálogo.

Nenhum teste automatizado dependerá de acesso real à Ticketmaster.

## Consequências

### Positivas

* O catálogo externo será efetivamente validado.
* A chave permanecerá restrita ao back-end.
* A aplicação continuará parcialmente utilizável sem a Ticketmaster.
* O snapshot protegerá os eventos locais de alterações externas.
* O mesmo item poderá originar diferentes sessões.
* A capacidade sempre corresponderá ao mapa persistido.
* Centavos inteiros evitarão erros de ponto flutuante.
* Assentos individuais permitirão controle preciso das reservas.
* Limites explícitos reduzirão a criação acidental de mapas excessivos.
* O ciclo de vida reduzirá estados ambíguos.
* Os testes não dependerão da disponibilidade do provedor externo.

### Negativas

* A criação de eventos dependerá da disponibilidade da Ticketmaster.
* Sem uma chave válida, novos eventos não poderão ser criados.
* A confirmação por ID adicionará uma chamada externa ao fluxo.
* O snapshot duplicará parte dos dados externos.
* Persistir cada assento aumentará a quantidade de registros.
* A criação de mapas maiores exigirá múltiplas inserções no banco.
* Eventos publicados não poderão ser corrigidos sem cancelamento.
* A ausência de exclusão manterá rascunhos antigos no banco.

## Alternativas consideradas

### Utilizar TMDB

Foi descartada porque a Ticketmaster representa de maneira mais direta o catálogo de shows escolhido para o Plateia.

### Permitir criação manual sem catálogo

Foi descartada porque contrariaria o requisito de criar eventos a partir de uma API externa e esconderia falhas relevantes durante a avaliação.

### Manter um catálogo local de contingência

Foi descartado porque permitiria criar eventos sem validação real da fonte externa.

### Tornar `TICKETMASTER_API_KEY` obrigatória na inicialização

Foi descartado porque impediria toda a API de iniciar, mesmo quando apenas as funcionalidades relacionadas ao catálogo estivessem indisponíveis.

### Expor a chave ao front-end

Foi descartado porque permitiria sua extração pelo navegador e o consumo indevido da cota.

### Tornar o ID da Ticketmaster único

Foi descartado porque impediria diferentes sessões baseadas no mesmo item externo.

### Utilizar diretamente a data e o local da Ticketmaster

Foi descartado porque o organizador precisa definir a sessão comercializada no Plateia.

### Armazenar somente a capacidade

Foi descartado porque não permitiria identificar lugares específicos nem garantir a unicidade dos assentos numerados.

### Armazenar capacidade e assentos

Foi descartado porque os dois valores poderiam divergir. A capacidade será sempre derivada dos assentos.

### Armazenar preço como número decimal

Foi descartado para evitar arredondamentos e inconsistências em operações monetárias.

### Armazenar disponibilidade diretamente no assento

Foi descartado porque a disponibilidade dependerá de reservas temporárias, pagamentos e ingressos, e não de um estado permanente do lugar.

### Permitir exclusão de eventos

Foi descartada no MVP para preservar o histórico necessário aos fluxos de reserva, ingresso e portaria.

### Criação de eventos

A criação utilizará `POST /api/events` e será restrita a usuários `ORGANIZER`.

A entrada conterá o ID da Ticketmaster, data e horário, local, preço em centavos e configuração das fileiras. A aplicação normalizará os dados antes da persistência.

A consulta externa ocorrerá antes da transação. A transação de banco conterá somente a criação do evento e de seus assentos, evitando manter recursos do PostgreSQL ocupados durante uma chamada de rede.

Em caso de sucesso, a API responderá `201 Created` com o evento em `DRAFT`, os dados do snapshot, o local normalizado e a capacidade derivada dos assentos.

Item externo inexistente responderá `404 CATALOG_EVENT_NOT_FOUND`. Indisponibilidade da Ticketmaster responderá `503 TICKETMASTER_UNAVAILABLE`.

## Referências

* [Ticketmaster Discovery API v2](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)
* [Ticketmaster API — Getting Started](https://developer.ticketmaster.com/products-and-docs/apis/getting-started/)
