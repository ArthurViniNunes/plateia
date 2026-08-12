# ADR 0011 — Modelar eventos, assentos e integração com a Ticketmaster

- **Status:** Aceito
- **Data:** 2026-08-11
- **Responsável pela decisão:** Arthur Vinicius Carneiro Nunes

## Contexto

O Plateia permite que organizadores criem eventos a partir de um catálogo externo de shows. O desafio admite a Ticketmaster Discovery API ou a TMDB como fonte desse catálogo.

A Ticketmaster foi escolhida por disponibilizar dados diretamente relacionados a shows e eventos. O item externo será utilizado como referência cultural, enquanto o organizador definirá a sessão comercializada no Plateia, incluindo data, horário, local, mapa de assentos e preço.

A dependência externa não deve comprometer os demais fluxos da aplicação. Cadastro, login e consulta aos eventos já persistidos deverão continuar disponíveis quando a Ticketmaster estiver indisponível. Entretanto, a pesquisa no catálogo e a criação de eventos dependerão da validação do item externo.

Também é necessário representar assentos numerados individualmente. Essa modelagem permite derivar a capacidade real do evento e impedir que um mesmo lugar seja reservado ou vendido mais de uma vez.

O organizador precisa consultar seus eventos independentemente do estado, publicar rascunhos e cancelar eventos. A agenda pública, por sua vez, não deve expor rascunhos nem eventos cancelados.

## Forças de decisão

- atender ao requisito de criação baseada em uma API externa;
- não expor a chave da Ticketmaster ao navegador;
- manter disponíveis os fluxos independentes do catálogo;
- preservar um snapshot dos dados externos utilizados na criação;
- representar assentos individualmente;
- derivar a capacidade do mapa persistido;
- impedir estados inconsistentes sob concorrência;
- preservar o histórico de eventos, reservas e ingressos;
- distinguir a consulta privada do organizador da agenda pública;
- manter a solução compatível com o prazo do MVP.

## Decisão

### Provedor externo

A Ticketmaster Discovery API v2 será a única fonte do catálogo externo no MVP.

Não haverá:

- integração com a TMDB;
- criação manual desvinculada do catálogo;
- catálogo local de contingência;
- dados externos inventados quando o provedor estiver indisponível.

A comunicação com a Ticketmaster será realizada exclusivamente pelo back-end. A chave de acesso não será enviada ao navegador nem incluída no código-fonte.

### Configuração da chave

A variável `TICKETMASTER_API_KEY` será opcional durante a inicialização da API.

Essa decisão permite que funcionalidades independentes, como cadastro, login, reservas, ingressos e consulta aos eventos persistidos, permaneçam disponíveis quando a chave não estiver configurada.

A chave será obrigatória para:

- pesquisar o catálogo externo;
- consultar um item da Ticketmaster por ID;
- criar um evento com base nesse item.

Quando a chave estiver ausente, as operações dependentes da Ticketmaster serão bloqueadas.

O arquivo `.env.example` documentará a variável sem fornecer uma credencial real:

```text
TICKETMASTER_API_KEY=
```

### Pesquisa no catálogo

A pesquisa utilizará:

```http
GET /api/catalog/events?query=<termo>
```

A rota exigirá autenticação e o papel `ORGANIZER`.

Requisições sem autenticação válida responderão `401 Unauthorized`. Usuários autenticados sem o papel necessário receberão `403 Forbidden`:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions"
  }
}
```

O parâmetro `query`:

- será obrigatório;
- terá os espaços externos removidos;
- deverá conter entre 2 e 100 caracteres.

Dados inválidos responderão `400 Bad Request`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data"
  }
}
```

A pesquisa será limitada ao Brasil por meio de `countryCode=BR` e retornará até 12 eventos por chamada.

O back-end retornará somente os campos necessários para a interface:

- ID externo;
- título;
- URL da imagem;
- classificação;
- URL original da Ticketmaster.

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

O envelope permite adicionar paginação ou metadados no futuro sem alterar o tipo raiz da resposta.

### Seleção da imagem e classificação

A imagem principal será a maior imagem disponível com proporção `16_9`.

Se não houver imagem nessa proporção, será utilizada a maior imagem disponível, independentemente da proporção.

A classificação priorizará o segmento informado pela Ticketmaster e utilizará o gênero como alternativa.

Quando não houver imagem, classificação ou URL externa, esses campos serão retornados como `null`.

### Timeout e limites externos

Cada chamada à Ticketmaster terá timeout de cinco segundos.

A integração respeitará os limites oficiais do provedor. Os testes automatizados utilizarão respostas simuladas e não consumirão a cota de uma chave real.

### Confirmação durante a criação

Antes de persistir um evento, a aplicação consultará novamente o item externo pelo ID:

```http
GET /discovery/v2/events/{id}
```

A criação somente continuará quando a Ticketmaster confirmar o item solicitado e retornar uma resposta compatível com o contrato esperado.

Essa consulta adicional impede a criação baseada em:

- IDs inventados;
- resultados desatualizados;
- dados manipulados pelo navegador;
- itens que deixaram de existir no catálogo.

A chamada externa ocorrerá antes da transação de banco. A transação conterá apenas a persistência do evento e de seus assentos, evitando manter recursos do PostgreSQL ocupados durante uma chamada de rede.

### Indisponibilidade da Ticketmaster

Serão tratadas como indisponibilidade:

- chave ausente ou inválida;
- resposta `401`;
- resposta `429`;
- respostas `5xx`;
- falha de rede;
- timeout;
- corpo incompatível com o contrato esperado.

Essas situações responderão `503 Service Unavailable`:

```json
{
  "error": {
    "code": "TICKETMASTER_UNAVAILABLE",
    "message": "Ticketmaster catalog is unavailable"
  }
}
```

Uma resposta válida indicando que o item não existe será tratada como recurso não encontrado:

```json
{
  "error": {
    "code": "CATALOG_EVENT_NOT_FOUND",
    "message": "Catalog event not found"
  }
}
```

A aplicação não utilizará dados inventados nem catálogo local como fallback.

### Snapshot do catálogo

Ao criar um evento, o Plateia armazenará um snapshot do item externo contendo:

- ID da Ticketmaster;
- título;
- URL da imagem, quando disponível;
- classificação, quando disponível;
- URL original da Ticketmaster, quando disponível;
- data e hora da consulta externa.

O snapshot preserva as informações utilizadas durante a criação mesmo que a Ticketmaster altere ou remova o item posteriormente.

O mesmo item da Ticketmaster poderá originar mais de um evento no Plateia. Isso permite criar sessões distintas a partir da mesma referência externa.

Consequentemente, o ID da Ticketmaster será indexado, mas não será único no banco local.

### Dados definidos pelo organizador

O organizador definirá:

- data e horário;
- nome do local;
- endereço;
- cidade;
- estado;
- fileiras;
- quantidade de assentos por fileira;
- preço único dos assentos.

A data e o horário serão recebidos com informação de fuso e armazenados em UTC.

O local será representado pelos campos:

- `venueName`;
- `address`;
- `city`;
- `state`.

Esses dados não precisam coincidir com o local ou a data informados pela Ticketmaster. O catálogo funciona como referência para a criação de uma sessão própria no Plateia.

A criação do rascunho exigirá data, local, mapa e preço preenchidos. A publicação repetirá as validações críticas para impedir que um evento inconsistente seja disponibilizado.

### Preço

Todos os assentos de um evento terão o mesmo preço.

Valores monetários serão armazenados como centavos inteiros, evitando cálculos com ponto flutuante.

O preço deverá ser positivo.

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

As seguintes restrições serão aplicadas:

- cada rótulo terá entre 1 e 10 caracteres;
- os rótulos serão únicos após normalização;
- cada evento terá no máximo 26 fileiras;
- cada fileira terá entre 1 e 100 assentos;
- a capacidade máxima será de 2.600 lugares.

Cada assento será persistido individualmente com:

- referência ao evento;
- rótulo da fileira;
- número do assento.

A combinação entre evento, fileira e número será única.

A capacidade não será armazenada como campo independente. Ela será derivada da quantidade de assentos persistidos, evitando divergência entre a capacidade declarada e o mapa efetivo.

A disponibilidade não será armazenada diretamente no assento. Ela será derivada de reservas temporárias e ingressos emitidos.

### Propriedade do evento

Todo evento pertencerá a um usuário organizador.

O banco armazenará a referência ao proprietário, enquanto a aplicação verificará se o usuário possui o papel `ORGANIZER`.

Somente o organizador proprietário poderá publicar ou cancelar o evento.

Eventos pertencentes a outro organizador serão ocultados por meio da mesma resposta utilizada para eventos inexistentes.

A exclusão de um organizador que possua eventos será bloqueada pelo banco.

### Ciclo de vida

Os eventos utilizarão os estados:

- `DRAFT`;
- `PUBLISHED`;
- `CANCELLED`.

As transições permitidas serão:

```text
DRAFT -> PUBLISHED
DRAFT -> CANCELLED
PUBLISHED -> CANCELLED
```

Não haverá:

- retorno de `PUBLISHED` para `DRAFT`;
- reabertura de eventos cancelados;
- exclusão de eventos pela API.

Somente eventos em `DRAFT` poderão ser editados caso uma operação de edição seja adicionada ao MVP.

A publicação exigirá:

- item da Ticketmaster previamente validado;
- data futura;
- local preenchido;
- preço positivo;
- pelo menos um assento.

Rascunhos e eventos publicados poderão ser cancelados pelo organizador proprietário.

Permitir o cancelamento do rascunho oferece uma forma explícita de encerrar eventos que não serão publicados sem apagar seu histórico.

Eventos não serão excluídos pela API no MVP. Essa decisão preserva o histórico necessário para reservas, ingressos e validações.

Caso um evento seja removido diretamente durante testes ou manutenção, seus assentos serão excluídos em cascata por pertencerem ao agregado do evento.

### Criação de eventos

A criação utilizará:

```http
POST /api/events
```

A rota será restrita a usuários autenticados com o papel `ORGANIZER`.

A entrada conterá:

- ID da Ticketmaster;
- data e horário;
- dados do local;
- preço em centavos;
- configuração das fileiras.

A aplicação normalizará os dados antes da persistência.

Em caso de sucesso, a API responderá `201 Created` com:

- evento em `DRAFT`;
- dados do snapshot;
- local normalizado;
- capacidade derivada dos assentos.

Item externo inexistente responderá `404 CATALOG_EVENT_NOT_FOUND`. Indisponibilidade da Ticketmaster responderá `503 TICKETMASTER_UNAVAILABLE`.

O evento e seus assentos serão criados em uma única transação.

### Publicação

A publicação utilizará:

```http
POST /api/events/:eventId/publish
```

Somente o organizador proprietário poderá publicar o evento.

Evento inexistente ou pertencente a outro organizador responderá:

```json
{
  "error": {
    "code": "EVENT_NOT_FOUND",
    "message": "Event not found"
  }
}
```

Eventos fora de `DRAFT` ou que não satisfaçam as condições de publicação responderão `409 Conflict`:

```json
{
  "error": {
    "code": "EVENT_CANNOT_BE_PUBLISHED",
    "message": "Event cannot be published"
  }
}
```

A alteração utilizará atualização condicional. Em tentativas concorrentes, somente uma publicação poderá ser concluída; as demais receberão conflito.

### Consulta pública de eventos

A consulta pública não dependerá da disponibilidade da Ticketmaster nem exigirá autenticação.

A listagem utilizará:

```http
GET /api/events
```

Serão retornados exclusivamente eventos:

- com estado `PUBLISHED`;
- cuja data e horário ainda estejam no futuro.

Os eventos serão ordenados pela data de início em ordem crescente. O identificador será utilizado como segundo critério para manter uma ordenação determinística quando dois eventos começarem no mesmo instante.

A listagem aceitará:

- `search`: busca parcial pelo título, sem diferenciar maiúsculas e minúsculas;
- `city`: correspondência exata da cidade, sem diferenciar maiúsculas e minúsculas;
- `startsFrom`: data inicial inclusiva;
- `startsTo`: data final inclusiva;
- `page`: página solicitada, com valor padrão 1;
- `limit`: quantidade por página, com valor padrão 12 e máximo 50.

Datas sem horário serão interpretadas em UTC. `startsFrom` representará o início do dia, às `00:00:00.000`, enquanto `startsTo` representará o final do dia, às `23:59:59.999`.

A resposta utilizará:

- `data`;
- `pagination`.

A paginação informará:

- página atual;
- limite;
- quantidade total de registros;
- quantidade total de páginas.

Quando não houver resultados, `total` e `totalPages` serão iguais a zero.

Parâmetros inválidos, paginação fora dos limites ou intervalo de datas invertido responderão `400 Bad Request`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters"
  }
}
```

### Detalhe público

O detalhe utilizará:

```http
GET /api/events/:eventId
```

A rota será pública.

Eventos inexistentes, identificadores malformados, rascunhos, eventos cancelados ou eventos cuja sessão já tenha ocorrido responderão de forma indistinguível:

```json
{
  "error": {
    "code": "EVENT_NOT_FOUND",
    "message": "Event not found"
  }
}
```

A resposta utilizará o mesmo formato básico da listagem e acrescentará o mapa de assentos no campo `rows`.

As fileiras serão ordenadas alfabeticamente, e os assentos serão ordenados numericamente.

Cada assento apresentará:

- identificador;
- número;
- estado calculado.

O estado comercial será derivado de reservas e ingressos, sem persistência direta no assento.

A capacidade continuará sendo derivada da quantidade de assentos persistidos.

### Consulta privada do organizador

A consulta privada utilizará:

```http
GET /api/events/mine
```

A rota exigirá autenticação e o papel `ORGANIZER`.

A resposta conterá somente os eventos pertencentes ao organizador autenticado, incluindo os estados `DRAFT`, `PUBLISHED` e `CANCELLED`:

```json
{
  "events": []
}
```

Os eventos serão ordenados pela data de criação em ordem decrescente, apresentando primeiro os itens criados mais recentemente.

Essa consulta é separada da agenda pública porque rascunhos e eventos cancelados não podem ser expostos aos clientes.

### Cancelamento

O cancelamento utilizará:

```http
POST /api/events/:eventId/cancel
```

Somente o organizador proprietário poderá cancelar o evento.

Eventos inexistentes ou pertencentes a outro organizador responderão de forma indistinguível:

```json
{
  "error": {
    "code": "EVENT_NOT_FOUND",
    "message": "Event not found"
  }
}
```

Eventos já cancelados ou em estado incompatível responderão `409 Conflict`:

```json
{
  "error": {
    "code": "EVENT_CANNOT_BE_CANCELLED",
    "message": "Event cannot be cancelled"
  }
}
```

A alteração utilizará atualização condicional para impedir que duas tentativas concorrentes concluam a mesma transição.

O cancelamento será executado em uma transação que:

- altera o evento para `CANCELLED`;
- identifica as reservas pendentes vinculadas ao evento;
- remove os bloqueios de assentos dessas reservas;
- altera as reservas pendentes para `EXPIRED`;
- preserva reservas pagas;
- preserva os ingressos emitidos.

Ingressos preservados passam a ser apresentados como `CANCELLED`, pois sua validade é derivada prioritariamente do estado do evento.

Não haverá simulação de estorno no MVP. Reservas pagas permanecerão registradas para preservar o histórico da compra.

## Estrutura conceitual

### Event

O evento armazenará:

- identificador UUID;
- organizador proprietário;
- ID externo da Ticketmaster;
- título;
- URL opcional da imagem;
- classificação opcional;
- URL externa opcional;
- data da consulta ao catálogo;
- data e horário da sessão;
- dados do local;
- preço em centavos;
- estado;
- datas de criação e atualização.

Serão criados índices para:

- organizador;
- estado e data da sessão;
- ID externo da Ticketmaster.

### Seat

O assento armazenará:

- identificador UUID;
- evento;
- rótulo da fileira;
- número;
- datas de criação e atualização.

A combinação entre evento, fileira e número será protegida por uma restrição de unicidade.

## Estratégia de testes

Os testes da integração com a Ticketmaster utilizarão transporte injetável e respostas HTTP simuladas.

Serão cobertos:

- pesquisa bem-sucedida;
- normalização do termo pesquisado;
- seleção da imagem principal;
- mapeamento da classificação;
- item encontrado por ID;
- chave ausente;
- resposta não autorizada;
- limite de requisições;
- indisponibilidade externa;
- timeout;
- resposta malformada;
- item inexistente.

Os testes da rota de catálogo também cobrirão:

- consulta realizada por organizador;
- autenticação ausente;
- papel sem permissão;
- parâmetro inválido;
- tradução da indisponibilidade externa para `503`.

Os testes de criação de evento utilizarão o PostgreSQL exclusivo de testes e uma implementação simulada do catálogo.

Os testes de publicação cobrirão:

- publicação de rascunho válido;
- evento pertencente a outro organizador;
- evento fora de `DRAFT`;
- duas tentativas concorrentes de publicação.

Os testes da consulta pública cobrirão:

- exposição exclusiva de eventos publicados e futuros;
- busca e filtros;
- paginação;
- ocultação de rascunhos;
- ocultação de eventos cancelados;
- ocultação de eventos passados;
- ordenação das fileiras e assentos;
- estados calculados dos assentos.

Os testes de gerenciamento também cobrirão:

- listagem de rascunhos, publicados e cancelados do organizador;
- ausência de eventos pertencentes a outros organizadores;
- cancelamento de evento próprio;
- ocultação de eventos pertencentes a terceiros;
- conflito ao repetir o cancelamento;
- expiração de reservas pendentes;
- liberação dos respectivos assentos;
- preservação de reservas pagas;
- invalidação dos ingressos pelo estado do evento;
- comportamento sob tentativas concorrentes.

Nenhum teste automatizado dependerá de acesso real à Ticketmaster.

## Consequências positivas

- O catálogo externo será efetivamente validado.
- A chave permanecerá restrita ao back-end.
- A aplicação continuará parcialmente utilizável sem a Ticketmaster.
- O snapshot protegerá os eventos locais de alterações externas.
- O mesmo item poderá originar diferentes sessões.
- A capacidade sempre corresponderá ao mapa persistido.
- Centavos inteiros evitarão erros de ponto flutuante.
- Assentos individuais permitirão controle preciso das reservas.
- Limites explícitos reduzirão a criação acidental de mapas excessivos.
- O ciclo de vida reduzirá estados ambíguos.
- Os testes não dependerão da disponibilidade do provedor externo.
- A consulta privada permitirá gerenciar eventos sem expor rascunhos ao público.
- O cancelamento preservará o histórico financeiro e operacional.
- Reservas pendentes não manterão assentos bloqueados após o cancelamento.
- A transação impedirá estados parciais entre evento, reservas e assentos.
- Ingressos emitidos refletirão automaticamente o cancelamento do evento.

## Consequências negativas e riscos

- A criação de eventos dependerá da disponibilidade da Ticketmaster.
- Sem uma chave válida, novos eventos não poderão ser criados.
- A confirmação por ID adicionará uma chamada externa ao fluxo.
- O snapshot duplicará parte dos dados externos.
- Persistir cada assento aumentará a quantidade de registros.
- A criação de mapas maiores exigirá múltiplas inserções no banco.
- Eventos publicados não poderão ser corrigidos sem cancelamento.
- Eventos cancelados continuarão ocupando espaço no banco.
- Rascunhos antigos permanecerão armazenados.
- Reservas pagas permanecerão registradas sem estorno simulado.
- O painel precisará distinguir claramente os três estados do evento.
- O cancelamento exige atualização coordenada de eventos, reservas e bloqueios.

## Medidas de mitigação

- manter timeout explícito para chamadas externas;
- validar todas as respostas da Ticketmaster;
- não manter transações abertas durante chamadas de rede;
- armazenar apenas os campos externos necessários;
- limitar fileiras e assentos;
- utilizar centavos inteiros;
- utilizar restrições de unicidade no banco;
- aplicar transações nas alterações que envolvam múltiplas entidades;
- utilizar atualizações condicionais nas transições de estado;
- ocultar recursos pertencentes a outros organizadores;
- manter testes de concorrência para publicação e cancelamento.

## Alternativas consideradas

### Utilizar TMDB

Foi descartada porque a Ticketmaster representa de maneira mais direta o catálogo de shows escolhido para o Plateia.

### Permitir criação manual sem catálogo

Foi descartada porque contrariaria o requisito de criar eventos a partir de uma API externa e esconderia falhas relevantes durante a avaliação.

### Manter catálogo local de contingência

Foi descartado porque permitiria criar eventos sem validação real da fonte externa.

### Tornar `TICKETMASTER_API_KEY` obrigatória na inicialização

Foi descartado porque impediria toda a API de iniciar, mesmo quando somente as funcionalidades relacionadas ao catálogo estivessem indisponíveis.

### Expor a chave ao front-end

Foi descartado porque permitiria sua extração pelo navegador e o consumo indevido da cota.

### Tornar o ID da Ticketmaster único

Foi descartado porque impediria diferentes sessões baseadas no mesmo item externo.

### Utilizar diretamente a data e o local da Ticketmaster

Foi descartado porque o organizador precisa definir a sessão comercializada no Plateia.

### Armazenar somente a capacidade

Foi descartado porque não permitiria identificar lugares específicos nem garantir a unicidade dos assentos numerados.

### Armazenar capacidade e assentos

Foi descartado porque os valores poderiam divergir. A capacidade será sempre derivada dos assentos.

### Armazenar preço como número decimal

Foi descartado para evitar arredondamentos e inconsistências em operações monetárias.

### Armazenar disponibilidade diretamente no assento

Foi descartado porque a disponibilidade depende de reservas temporárias, pagamentos e ingressos, e não de um estado permanente do lugar.

### Permitir exclusão de eventos

Foi descartada no MVP para preservar o histórico necessário aos fluxos de reserva, ingresso e portaria.

### Expor rascunhos na agenda pública

Foi descartado porque eventos ainda não publicados não devem ser apresentados aos clientes.

### Criar um painel baseado somente no estado local do navegador

Foi descartado porque impediria o organizador de recuperar e administrar eventos após atualizar a página ou entrar por outro dispositivo.

### Apagar reservas e ingressos durante o cancelamento

Foi descartado porque destruiria o histórico financeiro e operacional.

### Manter reservas pendentes após o cancelamento

Foi descartado porque assentos permaneceriam bloqueados em um evento que não aceitará novas compras.

## Gatilhos para reconsideração

- necessidade de integrar outros provedores de catálogo;
- necessidade de criar eventos sem referência externa;
- uso real exigir edição de eventos publicados;
- volume de assentos tornar a persistência individual insuficiente;
- necessidade regulatória ou financeira de implementar estornos;
- necessidade de arquivamento ou exclusão lógica;
- catálogo externo apresentar indisponibilidade incompatível com a operação;
- painel exigir paginação ou filtros na consulta privada;
- regras comerciais exigirem reabertura de eventos cancelados.

## Referências

- [Ticketmaster Discovery API v2](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)
- [Ticketmaster API — Getting Started](https://developer.ticketmaster.com/products-and-docs/apis/getting-started/)
