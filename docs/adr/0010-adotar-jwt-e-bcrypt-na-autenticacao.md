# ADR 0010: Adotar JWT e bcrypt na autenticação

- Status: Aceito
- Data: 2026-08-10

## Contexto

O Plateia possui três papéis: organizador, cliente e portaria. A API precisa identificar o usuário e restringir operações conforme seu papel.

O cadastro público será permitido somente para clientes. Organizadores e usuários de portaria serão contas internas criadas por seed.

O prazo reduzido do desafio exige uma solução segura, simples de demonstrar e compatível com a arquitetura stateless da API.

## Decisão

A autenticação utilizará JWT enviado pelo cabeçalho `Authorization` no formato `Bearer <token>`.

O token:

- será emitido somente após login;
- terá duração de oito horas;
- não terá refresh token no MVP;
- será assinado com `JWT_SECRET`, variável obrigatória do ambiente;
- identificará o usuário por ID e papel.

As senhas serão protegidas com `bcrypt`, usando custo 12.

O cadastro:

- aceitará nome completo, e-mail e senha;
- normalizará o e-mail em minúsculas;
- exigirá senha com pelo menos oito caracteres;
- criará exclusivamente usuários `CUSTOMER`;
- responderá `201 Created` sem autenticar o usuário;
- responderá `409 Conflict` para e-mail já cadastrado;
- nunca retornará o hash da senha.

O login responderá `200 OK` com o token e os dados públicos do usuário. Credenciais inválidas responderão `401 Unauthorized` com mensagem genérica.

Os testes de integração utilizarão o PostgreSQL de testes e limparão os usuários antes de cada caso enquanto a entidade ainda não possuir relacionamentos.

## Consequências

### Positivas

- API permanece stateless.
- A solução funciona naturalmente com o front-end React.
- O bcrypt é conhecido e amplamente utilizado.
- A expiração reduz a duração de uma credencial comprometida.
- Respostas genéricas de login evitam revelar se determinado e-mail existe.

### Negativas

- Sem refresh token, o usuário deverá entrar novamente após oito horas.
- Revogação imediata de tokens não será suportada no MVP.
- O custo do bcrypt aumenta o tempo dos testes que exercitam hashing real.
- A limpeza direta da tabela será revista quando surgirem relacionamentos.

## Alternativas consideradas

### Sessões persistidas no servidor

Não adotadas porque exigiriam armazenamento e gerenciamento adicional de sessão.

### Refresh token

Descartado no MVP por ampliar o escopo de armazenamento, rotação e revogação de credenciais.

### scrypt nativo do Node.js

É uma alternativa segura, mas o bcrypt foi escolhido por familiaridade da equipe e reconhecimento no ecossistema.

### bcryptjs

Evitaria componentes nativos, mas foi preterido em favor da implementação nativa do bcrypt.
