# ADR 0013 — Validar ingressos atomicamente na portaria

- **Status:** Aceito
- **Data:** 2026-08-12
- **Responsável pela decisão:** Arthur Vinicius Carneiro Nunes

## Contexto

A portaria precisa validar o código apresentado pelo cliente e oferecer retorno claro para quatro situações exigidas pelo desafio:

- ingresso válido;
- código inválido;
- ingresso já utilizado;
- ingresso pertencente a outro evento.

A validação poderá receber códigos digitados manualmente ou extraídos de um QR pela interface. Independentemente da origem, a API será a autoridade responsável por consultar o ingresso e registrar seu uso.

Duas requisições podem tentar validar o mesmo ingresso quase simultaneamente. Uma consulta seguida de atualização sem coordenação poderia permitir que ambas o considerassem válido.

Também é necessário estabelecer até quando um ingresso pode ser validado. O modelo atual registra o início da sessão, mas não possui horário de término nem fuso específico do local.

## Forças de decisão

- impedir a utilização duplicada;
- apresentar respostas simples e imediatas à portaria;
- distinguir ingresso de outro evento sem consumi-lo;
- não expor detalhes internos desnecessários;
- manter o banco como fonte autoritativa;
- permitir digitação manual e leitura por QR;
- preservar uma implementação demonstrável no prazo;
- definir uma janela compatível com o modelo atual.

## Alternativas consideradas

### Responder com diferentes códigos HTTP para cada resultado

Seria semanticamente defensável, mas obrigaria a interface da portaria a tratar resultados normais de negócio como falhas HTTP. Os quatro resultados esperados utilizarão `200 OK`, deixando códigos `4xx` para autenticação, autorização ou entrada malformada.

### Validar somente pelo ID do ingresso

Exporia um identificador interno e não utilizaria a credencial opaca criada para QR e compartilhamento.

### Confiar nos dados contidos no QR

Permitiria validação sem consulta, mas dificultaria reconhecer cancelamento e uso anterior. O QR conterá apenas o endereço com o código; a situação será consultada no banco.

### Atualizar sem bloqueio pessimista

Duas requisições poderiam ler `usedAt` como nulo e validar o mesmo ingresso. A linha será bloqueada antes da decisão.

### Permitir validação somente no horário exato da sessão

Exigiria modelar tolerância, horário de abertura e duração do evento. Essa precisão não existe no domínio atual.

### Considerar inválido imediatamente após o início

Impediria a entrada durante a própria sessão, pois o modelo não armazena o horário de término.

### Permitir validação sem limite posterior

Simplificaria a regra, mas permitiria utilizar ingressos muito depois do encerramento presumido.

## Decisão

### Contrato HTTP

A validação utilizará:

`POST /api/gate/validate`

A rota exigirá autenticação e será restrita a usuários com o papel `GATEKEEPER`.

O corpo conterá:

- `eventId`: UUID do evento selecionado pela portaria;
- `code`: código obtido por digitação ou leitura do QR.

Dados malformados responderão `400 Bad Request`, com o código `VALIDATION_ERROR`.

Requisições sem autenticação válida responderão `401 Unauthorized`.

Usuários autenticados sem o papel de portaria responderão `403 Forbidden`, com o código `FORBIDDEN`.

### Resultados de negócio

Os resultados esperados responderão `200 OK`.

#### `VALID`

Será retornado quando:

- o código existir;
- o ingresso pertencer ao evento selecionado;
- o evento não estiver cancelado;
- a janela de validação ainda estiver aberta;
- o ingresso ainda não tiver sido utilizado.

A aplicação preencherá `usedAt` e retornará o instante da validação, o ingresso, o evento e o assento.

#### `INVALID`

Será retornado quando:

- o código não existir;
- o evento estiver cancelado;
- a janela de validação tiver encerrado.

Essas situações não alterarão o ingresso.

#### `ALREADY_USED`

Será retornado quando `usedAt` já estiver preenchido.

O instante original será preservado. Uma nova tentativa não atualizará `usedAt`.

#### `WRONG_EVENT`

Será retornado quando o código existir, mas o ingresso pertencer a evento diferente daquele selecionado pela portaria.

O ingresso não será consumido.

### Janela de validação

A validação será permitida antes do início e até seis horas depois de `startsAt`.

A antecipação facilita a abertura dos portões e a demonstração do fluxo. O limite posterior representa uma duração operacional presumida, necessária porque o MVP ainda não armazena horário de encerramento.

Depois de `startsAt + 6 horas`, um ingresso ainda não utilizado responderá `INVALID`.

Essa duração é uma decisão provisória do MVP e deverá ser substituída por dados explícitos de abertura e encerramento caso o domínio evolua.

### Concorrência

A consulta utilizará o código opaco e bloqueará a linha do ingresso no PostgreSQL com `SELECT ... FOR UPDATE`.

Os dados necessários do evento e do assento serão obtidos na mesma consulta tipada por meio de junções. O bloqueio será limitado à linha do ingresso.

Duas validações concorrentes do mesmo código serão serializadas:

1. a primeira observará `usedAt` vazio e retornará `VALID`;
2. a segunda aguardará a transação anterior;
3. depois do commit, observará `usedAt` preenchido e retornará `ALREADY_USED`.

### Leitura por QR e digitação

A API não distinguirá a origem do código.

A interface poderá:

- extrair o código do link contido no QR;
- aceitar a colagem do link completo;
- permitir digitação manual do código.

Todas as opções utilizarão o mesmo endpoint, evitando regras divergentes.

A leitura pela câmera será responsabilidade do front-end e não alterará o contrato de validação.

## Estratégia de testes

Os testes utilizarão o PostgreSQL exclusivo de testes e cobrirão:

- validação bem-sucedida;
- persistência de `usedAt`;
- código inexistente;
- ingresso já utilizado;
- preservação do instante original;
- ingresso de outro evento;
- não consumo no evento errado;
- evento cancelado;
- janela superior a seis horas;
- requisição sem autenticação;
- papel sem permissão;
- entrada malformada;
- duas validações concorrentes.

O teste concorrente deverá demonstrar exatamente um resultado `VALID` e um resultado `ALREADY_USED`.

## Consequências positivas

- impede uso duplicado sob concorrência;
- oferece respostas diretas para a interface;
- mantém a decisão no banco e na API;
- não consome ingresso apresentado no evento errado;
- reconhece imediatamente cancelamentos;
- suporta câmera e entrada manual com o mesmo contrato;
- evita uma consulta adicional dentro da transação;
- possui comportamento concorrente comprovado por teste.

## Consequências negativas e riscos

- resultados de negócio diferentes compartilham `200 OK`;
- código inexistente e evento cancelado são agrupados como `INVALID`;
- a janela de seis horas é uma aproximação;
- validação antecipada permite consumir o ingresso antes do início;
- a operação depende de conexão com a API e o banco;
- contenção pode causar espera em leituras simultâneas do mesmo código;
- não existe modo offline no MVP.

## Medidas de mitigação

- apresentar cores, ícones e mensagens distintas na interface;
- bloquear a linha antes de verificar e atualizar o uso;
- preservar `usedAt` após a primeira validação;
- não consumir ingresso de outro evento;
- consultar o estado atual do evento;
- documentar a janela provisória;
- permitir entrada manual quando a câmera não estiver disponível;
- registrar horário de término em uma evolução futura.

## Gatilhos para reconsideração

- eventos precisarem de horários explícitos de abertura e término;
- portaria precisar funcionar sem internet;
- volume de validações causar contenção relevante;
- políticas exigirem tolerância configurável;
- o QR passar a transportar dados assinados;
- auditoria exigir histórico de todas as tentativas;
- houver necessidade de múltiplos acessos com o mesmo ingresso.
