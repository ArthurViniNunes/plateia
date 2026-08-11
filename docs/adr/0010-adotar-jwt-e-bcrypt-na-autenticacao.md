# ADR 0010: Adotar JWT e bcrypt na autenticação

* Status: Aceito
* Data: 2026-08-10
* Última atualização: 2026-08-11

## Contexto

O Plateia possui três papéis de usuário:

* `ORGANIZER`: cria e gerencia eventos;
* `CUSTOMER`: reserva lugares, realiza pagamentos simulados e recebe ingressos;
* `GATEKEEPER`: valida ingressos na entrada dos eventos.

A API precisa identificar o usuário, proteger recursos privados e restringir operações conforme o papel associado à conta.

O cadastro público será permitido exclusivamente para clientes. As contas de organizador e portaria serão internas e criadas por meio de seed.

Considerando o prazo do desafio, a solução precisa ser segura, simples de executar e adequada a uma API consumida por uma aplicação React, sem introduzir o gerenciamento de sessões persistidas no servidor.

## Decisão

### Autenticação

A autenticação utilizará JWT enviado pelo cabeçalho HTTP `Authorization`, no formato:

```text
Authorization: Bearer <token>
```

O token:

* será emitido somente após login bem-sucedido;
* não será emitido automaticamente após o cadastro;
* utilizará o algoritmo `HS256`;
* terá validade de oito horas;
* não utilizará refresh token no MVP;
* será assinado com `JWT_SECRET`;
* exigirá um segredo com pelo menos 32 caracteres;
* utilizará o ID do usuário no claim `sub`;
* incluirá o papel do usuário no claim `role`;
* utilizará `plateia-api` como `issuer`;
* utilizará `plateia-web` como `audience`.

O `JWT_SECRET` será obrigatório em todos os ambientes. A aplicação deverá falhar imediatamente durante a inicialização caso ele esteja ausente ou seja inválido.

### Armazenamento de senhas

As senhas serão protegidas com `bcrypt`, utilizando custo 12.

As senhas aceitas pela aplicação deverão possuir:

* no mínimo 8 caracteres;
* no máximo 72 bytes, respeitando o limite efetivamente processado pelo bcrypt.

O hash da senha nunca será retornado pela API.

### Cadastro de clientes

O endpoint de cadastro aceitará nome, e-mail e senha.

Os dados serão tratados da seguinte forma:

* o nome será aparado e deverá possuir entre 2 e 120 caracteres;
* o e-mail será aparado, convertido para letras minúsculas e limitado a 254 caracteres;
* a senha seguirá os limites definidos para o bcrypt;
* todo cadastro público criará exclusivamente um usuário `CUSTOMER`.

Em caso de sucesso, a API responderá `201 Created` com os dados públicos do usuário, sem emitir um token.

Dados malformados responderão `400 Bad Request`:

```json
{
"error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data"
    }
}
```

Quando o e-mail já estiver cadastrado, a API responderá `409 Conflict`:

```json
{
"error": {
    "code": "EMAIL_ALREADY_REGISTERED",
    "message": "Email already registered"
    }
}
```

### Login

O login receberá e-mail e senha. O e-mail será aparado e convertido para letras minúsculas antes da busca.

Em caso de sucesso, a API responderá `200 OK`:

```json
{
"token": "<jwt>",
"user": {
    "id": "<uuid>",
    "name": "<nome>",
    "email": "<email>",
    "role": "<papel>"
    }
}
```

Dados malformados responderão `400 Bad Request` com o código `VALIDATION_ERROR`.

E-mail inexistente e senha incorreta responderão de forma indistinguível com `401 Unauthorized`:

```json
{
"error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
    }
}
```

A resposta genérica evita revelar se determinado e-mail está cadastrado.

### Validação de requisições protegidas

Após validar assinatura, algoritmo, expiração, emissor e audiência do JWT, a aplicação consultará o usuário no banco de dados.

Essa consulta permitirá:

* rejeitar tokens associados a usuários removidos;
* utilizar o papel atual armazenado no banco;
* aplicar alterações de papel sem aguardar a expiração do token.

O banco de dados será a fonte de verdade para o papel do usuário. O claim `role` continuará presente no JWT como parte do contrato do token, mas não substituirá a consulta ao registro atual.

Token ausente, malformado, inválido, expirado ou associado a um usuário inexistente responderá de forma indistinguível com `401 Unauthorized`:

```json
{
"error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
    }
}
```

### Contas semeadas

O seed criará as seguintes contas de demonstração:

| Papel       | E-mail                     |
| ----------- | -------------------------- |
| Organizador | `organizer@plateia.local`  |
| Cliente 1   | `customer1@plateia.local`  |
| Cliente 2   | `customer2@plateia.local`  |
| Portaria    | `gatekeeper@plateia.local` |

As contas utilizarão a senha comum de demonstração:

```text
Plateia123!
```

Essa senha será documentada no README e utilizada exclusivamente em ambientes locais ou de avaliação. Ela não deverá ser reutilizada em um ambiente real de produção.

O seed utilizará `upsert` por e-mail para ser idempotente. Dessa forma, sua execução repetida atualizará ou preservará as contas esperadas sem criar duplicidades.

Posteriormente, o seed será ampliado para incluir pelo menos um evento publicado com ingressos disponíveis, conforme os requisitos do desafio.

### Estratégia de testes

Os testes de integração utilizarão o PostgreSQL exclusivo de testes.

Enquanto os testes compartilharem o mesmo banco e realizarem limpeza explícita dos dados, os arquivos serão executados sequencialmente. Essa decisão e suas consequências estão detalhadas no ADR 0003.

## Consequências

### Positivas

* A API não precisa armazenar sessões de usuário no servidor.
* A solução se integra naturalmente ao front-end React.
* Tokens expiram automaticamente após oito horas.
* O bcrypt é conhecido e amplamente utilizado.
* O limite de 72 bytes evita aceitar senhas cujo conteúdo seria parcialmente ignorado pelo bcrypt.
* Respostas genéricas de login reduzem a enumeração de contas.
* Usuários removidos deixam de acessar rotas protegidas imediatamente.
* Alterações de papel passam a valer sem aguardar a expiração do JWT.
* O seed idempotente facilita a execução e a avaliação do projeto.

### Negativas

* Sem refresh token, o usuário deverá realizar novo login após oito horas.
* A aplicação não oferecerá revogação individual de tokens ou uma lista de bloqueio no MVP.
* Cada requisição protegida realizará uma consulta adicional ao banco.
* O custo 12 do bcrypt aumenta o tempo necessário para cadastro, login, seed e testes.
* Os testes de integração ficam mais lentos devido ao hashing real de senhas.
* Credenciais fixas de demonstração não são adequadas para um ambiente real de produção.
* A execução sequencial dos testes poderá aumentar o tempo da suíte conforme o projeto crescer.

## Alternativas consideradas

### Sessões persistidas no servidor

Não adotadas porque exigiriam armazenamento, expiração e gerenciamento adicional de sessões.

### Refresh token

Descartado no MVP porque ampliaria o escopo de armazenamento, rotação, revogação e proteção de credenciais.

### JWT sem consulta ao banco

Permitiria uma autorização totalmente baseada no token e reduziria consultas. Foi descartado porque usuários removidos e alterações de papel continuariam válidos até a expiração do JWT.

### Lista de revogação de tokens

Permitiria invalidar tokens individualmente, mas exigiria armazenamento e gerenciamento adicional. Não será implementada no MVP.

### `scrypt` nativo do Node.js

É uma alternativa segura e reduziria dependências externas. O bcrypt foi escolhido pela familiaridade da equipe e pelo reconhecimento no ecossistema.

### `bcryptjs`

Evitaria componentes nativos, mas foi preterido em favor da implementação nativa do bcrypt.

### Contas internas criadas manualmente

Foi descartada porque tornaria a configuração inicial menos reproduzível e dificultaria a avaliação do projeto.
