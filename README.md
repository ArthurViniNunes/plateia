# Plateia

Plataforma de eventos e ingressos desenvolvida para o **Desafio Elite Dev da Verzel**.

O Plateia permite que um organizador crie eventos a partir do catálogo da Ticketmaster, configure um mapa de assentos, publique ou cancele sessões e acompanhe seus eventos. Clientes podem reservar lugares, realizar um pagamento simulado e receber ingressos com QR Code. Na entrada, a portaria valida os ingressos por digitação manual ou leitura pela câmera.

## Funcionalidades

### Cliente

- cadastro público;
- autenticação com e-mail e senha;
- consulta à agenda de eventos publicados;
- visualização dos detalhes e do mapa de assentos;
- seleção de até quatro assentos;
- bloqueio dos lugares por dez minutos;
- pagamento simulado com aprovação ou recusa;
- emissão de um ingresso por assento;
- consulta aos próprios ingressos;
- ingresso público compartilhável por link;
- QR Code com código antifraude.

### Organizador

- autenticação por conta interna;
- pesquisa de atrações na Ticketmaster;
- criação de eventos em rascunho;
- configuração de data, local, preço, fileiras e assentos;
- consulta aos próprios eventos;
- publicação de rascunhos;
- cancelamento de rascunhos ou eventos publicados;
- preservação do histórico após cancelamento.

### Portaria

- autenticação por conta interna;
- validação manual pelo código do ingresso;
- leitura do QR Code pela câmera;
- identificação clara dos resultados:

  - válido;
  - inválido;
  - já utilizado;
  - evento incorreto;

- prevenção de validação duplicada.

## Regras principais

- somente clientes podem se cadastrar publicamente;
- organizadores e usuários de portaria são criados pelo seed;
- cada evento pertence a um organizador;
- a criação de eventos depende da confirmação do item na Ticketmaster;
- todos os lugares de um evento possuem o mesmo preço;
- um cliente pode reservar entre um e quatro assentos;
- uma reserva pendente expira após dez minutos;
- o banco de dados é a fonte autoritativa para disponibilidade;
- somente uma reserva concorrente pode ocupar determinado assento;
- o pagamento é simulado e pode ser aprovado ou recusado;
- o pagamento aprovado emite um ingresso por assento;
- ingressos não podem ser utilizados duas vezes;
- o cancelamento invalida os ingressos do evento;
- não há simulação de estorno no MVP;
- reservas pendentes são expiradas e liberadas quando o evento é cancelado.

## Arquitetura

O projeto utiliza um monorepo com npm workspaces:

```text
plateia/
├── apps/
│   ├── api/                 # API HTTP, regras de negócio e persistência
│   └── web/                 # Aplicação React
├── docs/
│   └── adr/                 # Registros das decisões arquiteturais
├── .github/
│   └── workflows/ci.yml     # Pipeline de integração contínua
├── compose.yaml             # PostgreSQL de desenvolvimento e testes
└── package.json
```

### Back-end

- Node.js;
- TypeScript;
- Express;
- PostgreSQL 17;
- Prisma ORM;
- Zod;
- JWT com `jose`;
- bcrypt;
- Vitest;
- Supertest.

### Front-end

- React;
- TypeScript;
- Vite;
- Material UI;
- React Router;
- Zod;
- React Testing Library;
- `qrcode.react`;
- `@zxing/browser`.

### Qualidade

- ESLint com análise tipada;
- Prettier;
- Vitest;
- testes de integração com PostgreSQL;
- GitHub Actions;
- Conventional Commits.

## Decisões arquiteturais

As principais decisões estão documentadas em [docs/adr](docs/adr).

Entre elas:

- monorepo com TypeScript;
- PostgreSQL, Prisma e Docker Compose;
- desenvolvimento orientado a testes;
- autenticação com papéis;
- eventos com assentos numerados;
- reservas temporárias de dez minutos;
- integração sem fallback com a Ticketmaster;
- identidade visual editorial com Material UI;
- validação imediata da configuração;
- JWT e bcrypt;
- ciclo de vida dos eventos;
- pagamento simulado e emissão de ingressos;
- validação dos ingressos na portaria.

## Requisitos locais

Antes de iniciar, instale:

- Git;
- Node.js 24;
- npm 11;
- Docker Desktop com Docker Compose;
- uma chave da Ticketmaster Discovery API para pesquisar e criar eventos.

Confirme as ferramentas:

```powershell
node --version
npm --version
docker --version
docker compose version
```

Versões utilizadas durante o desenvolvimento:

```text
Node.js 24.18.0
npm 11.16.0
PostgreSQL 17 Alpine
```

## Configuração

### 1. Clonar o repositório

```powershell
git clone <https://github.com/ArthurViniNunes/plateia.git>
cd plateia
```

### 2. Instalar as dependências

```powershell
npm install
```

A instalação utiliza o `package-lock.json` da raiz e prepara os workspaces da API e da aplicação web.

### 3. Criar os arquivos de ambiente

No PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/api/.env.test.example apps/api/.env.test
Copy-Item apps/web/.env.example apps/web/.env
```

No Git Bash, Linux ou macOS:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/api/.env.test.example apps/api/.env.test
cp apps/web/.env.example apps/web/.env
```

Os arquivos `.env` e `.env.test` contêm configuração local e não devem ser versionados.

### 4. Configurar a Ticketmaster

Edite `apps/api/.env` e informe uma chave válida:

```dotenv
TICKETMASTER_API_KEY=sua_chave_da_ticketmaster
```

A chave pode ser obtida no portal de desenvolvedores da Ticketmaster.

Sem essa variável, a API continua disponível para autenticação, agenda, reservas, ingressos e portaria. Entretanto, a pesquisa no catálogo e a criação de novos eventos são bloqueadas.

Nunca exponha essa chave no front-end.

### 5. Configurar os segredos JWT

Substitua os valores de exemplo em:

- `apps/api/.env`;
- `apps/api/.env.test`.

Cada segredo deve possuir pelo menos 32 caracteres:

```dotenv
JWT_SECRET=utilize_um_segredo_local_com_ao_menos_32_caracteres
```

Não reutilize segredos de produção em desenvolvimento ou testes.

## Banco de dados

O Compose inicia dois bancos PostgreSQL:

| Finalidade      | Serviço         | Porta local | Persistência  |
| --------------- | --------------- | ----------: | ------------- |
| Desenvolvimento | `postgres`      |        5432 | volume Docker |
| Testes          | `postgres-test` |        5433 | efêmero       |

Inicie os bancos:

```powershell
docker compose up -d
docker compose ps
```

Aguarde até que os dois serviços estejam saudáveis.

Para acompanhar os logs:

```powershell
docker compose logs -f postgres postgres-test
```

Para interromper os contêineres:

```powershell
docker compose down
```

Para remover também o volume do banco de desenvolvimento:

```powershell
docker compose down --volumes
```

Esse último comando apaga os dados locais persistidos.

## Prisma

### Gerar o Prisma Client

```powershell
npm run prisma:generate --workspace apps/api
```

### Aplicar migrations no banco de desenvolvimento

```powershell
npm run prisma:migrate:deploy --workspace apps/api
```

### Popular os dados de demonstração

```powershell
npm run prisma:seed --workspace apps/api
```

O seed é idempotente: pode ser executado novamente sem duplicar as contas, o evento ou os assentos demonstrativos.

### Preparar o banco de testes

No PowerShell:

```powershell
$env:DATABASE_URL="postgresql://plateia_test:plateia_test_password@localhost:5433/plateia_test?schema=public"
npm run prisma:migrate:deploy --workspace apps/api
Remove-Item Env:DATABASE_URL
```

Esse endereço deve coincidir com `apps/api/.env.test` e com as credenciais configuradas na raiz.

## Dados de demonstração

Todas as contas abaixo utilizam a senha:

```text
Plateia123!
```

| Papel       | E-mail                     |
| ----------- | -------------------------- |
| Organizador | `organizer@plateia.local`  |
| Cliente 1   | `customer1@plateia.local`  |
| Cliente 2   | `customer2@plateia.local`  |
| Portaria    | `gatekeeper@plateia.local` |

O seed também cria:

- evento: **Corujão Plateia - Noite de Código**;
- situação: publicado;
- início: 20/08/2099 às 20:00, no fuso de Fortaleza;
- local: Teatro Plateia;
- endereço: Rua da Cultura, 100;
- cidade: Fortaleza;
- preço: R$ 150,00 por assento;
- fileiras: A, B e C;
- assentos: oito por fileira;
- capacidade total: 24 lugares.

O evento inicia sem reservas ou ingressos, deixando todos os assentos disponíveis.

> As credenciais e o evento acima existem exclusivamente para desenvolvimento e avaliação. Não devem ser utilizados em produção.

## Executar a aplicação

Use dois terminais.

### Terminal 1 — API

```powershell
npm run dev --workspace apps/api
```

A API ficará disponível em:

```text
<http://localhost:3333>
```

Verifique a saúde:

```text
<http://localhost:3333/health>
```

Resposta esperada:

```json
{
  "status": "ok"
}
```

### Terminal 2 — Front-end

```powershell
npm run dev --workspace apps/web
```

A aplicação ficará disponível em:

```text
<http://localhost:5173>
```

## Roteiro de avaliação

### Jornada do cliente

1. Acesse `http://localhost:5173`.
2. Abra o evento **Corujão Plateia - Noite de Código**.
3. Selecione até quatro assentos.
4. Continue para a reserva.
5. Entre com `customer1@plateia.local` ou crie uma nova conta.
6. Aprove ou recuse o pagamento simulado.
7. Em caso de aprovação, abra “Meus ingressos”.
8. Visualize o QR Code e o link público do ingresso.

### Jornada do organizador

1. Entre com `organizer@plateia.local`.
2. Acesse “Gerenciar eventos”.
3. Consulte os eventos existentes.
4. Pesquise uma atração na Ticketmaster.
5. Configure data, local, preço e fileiras.
6. Crie o rascunho.
7. Publique ou cancele um evento.

A pesquisa e a criação dependem de uma `TICKETMASTER_API_KEY` válida.

### Jornada da portaria

1. Entre com `gatekeeper@plateia.local`.
2. Acesse “Portaria”.
3. Informe o identificador do evento.
4. Digite o código do ingresso ou leia o QR Code pela câmera.
5. Valide o ingresso.
6. Repita a operação para verificar o retorno “já utilizado”.

A câmera exige `localhost` ou HTTPS e permissão do navegador.

## Rotas principais da API

### Autenticação

| Método | Rota                 | Acesso      |
| ------ | -------------------- | ----------- |
| `POST` | `/api/auth/register` | Público     |
| `POST` | `/api/auth/login`    | Público     |
| `GET`  | `/api/auth/me`       | Autenticado |

### Catálogo e eventos

| Método | Rota                           | Acesso      |
| ------ | ------------------------------ | ----------- |
| `GET`  | `/api/catalog/events`          | Organizador |
| `GET`  | `/api/events`                  | Público     |
| `GET`  | `/api/events/:eventId`         | Público     |
| `GET`  | `/api/events/mine`             | Organizador |
| `POST` | `/api/events`                  | Organizador |
| `POST` | `/api/events/:eventId/publish` | Organizador |
| `POST` | `/api/events/:eventId/cancel`  | Organizador |

### Reservas e pagamentos

| Método | Rota                                       | Acesso  |
| ------ | ------------------------------------------ | ------- |
| `POST` | `/api/events/:eventId/reservations`        | Cliente |
| `POST` | `/api/reservations/:reservationId/payment` | Cliente |

### Ingressos e portaria

| Método | Rota                 | Acesso              |
| ------ | -------------------- | ------------------- |
| `GET`  | `/api/tickets`       | Cliente             |
| `GET`  | `/api/tickets/:code` | Público pelo código |
| `POST` | `/api/gate/validate` | Portaria            |

## Testes e verificações

### Executar todos os testes

Certifique-se de que o banco de testes esteja iniciado e com as migrations aplicadas:

```powershell
npm test
```

### Executar somente a API

```powershell
npm test --workspace apps/api
```

### Executar somente o front-end

```powershell
npm test --workspace apps/web
```

### Modo de observação

```powershell
npm run test:watch --workspace apps/api
npm run test:watch --workspace apps/web
```

### Validação completa

```powershell
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

## Integração contínua

O workflow em `.github/workflows/ci.yml` executa em:

- pushes para a branch principal;
- pull requests direcionados à branch principal;
- acionamento manual.

O pipeline:

1. instala as dependências com `npm ci`;
2. gera o Prisma Client;
3. valida a formatação;
4. executa o ESLint;
5. verifica os tipos;
6. inicia o PostgreSQL de testes;
7. aplica as migrations;
8. executa os testes;
9. gera os builds.

## Segurança

As principais medidas adotadas incluem:

- senhas protegidas com bcrypt e custo 12;
- JWT assinado com `HS256`;
- validade de oito horas;
- ausência de hash de senha nas respostas;
- resposta indistinguível para e-mail inexistente e senha incorreta;
- autorização baseada em papéis;
- consulta do usuário no banco em cada requisição protegida;
- chave da Ticketmaster restrita à API;
- validação de entradas e respostas externas com Zod;
- códigos de ingresso aleatórios e não previsíveis;
- transações e restrições de unicidade para concorrência;
- invalidação de ingressos utilizados ou vinculados a eventos cancelados;
- CORS restrito a uma origem por ambiente;
- variáveis obrigatórias validadas na inicialização.

## Uso de inteligência artificial

Foram utilizadas as ferramentas **GitHub Copilot** e **ChatGPT**.

A inteligência artificial auxiliou em:

- levantamento de requisitos;
- discussão arquitetural;
- documentação.

As decisões finais, a execução local, a observação dos testes, a validação dos comportamentos e o versionamento permaneceram sob responsabilidade humana.

Foram realizados sem IA:

- configuração manual do ambiente;
- execução dos comandos;
- revisão das entregas;
- decisões de produto.

Os artefatos de decisão produzidos durante o desenvolvimento foram versionados em `docs/adr`, permitindo acompanhar o raciocínio, as alternativas consideradas e as consequências das escolhas.

## Limitações conhecidas

Este é um MVP de desafio técnico. Não foram implementados:

- transações financeiras reais;
- estorno de pagamentos;
- nota fiscal;
- recuperação de senha;
- envio de ingressos por e-mail;
- revenda de ingressos;
- transferência de titularidade;
- aplicativo nativo;
- refresh token;
- painel financeiro;
- escolha de diferentes preços por setor;
- reabertura de evento cancelado;
- fallback local para indisponibilidade da Ticketmaster.

Outras limitações deliberadas:

- a sessão do navegador utiliza `sessionStorage`;
- fechar a aba encerra a sessão local;
- o pagamento é explicitamente simulado;
- o mapa utiliza um preço único;
- o QR Code contém o código antifraude do ingresso;
- a câmera depende de permissão e contexto seguro;
- a reserva expirada é reconhecida nas operações críticas, sem depender exclusivamente de um processo agendado.

## Ambientes publicados

O Plateia também está disponível para avaliação em produção:

| Serviço        | Plataforma            | Endereço                                                                             |
| -------------- | --------------------- | ------------------------------------------------------------------------------------ |
| Aplicação web  | Vercel                | [plateia-ingressos.vercel.app](https://plateia-ingressos.vercel.app/)                |
| API            | Render                | [plateia-api-31dp.onrender.com](https://plateia-api-31dp.onrender.com/)              |
| Health check   | Render                | [plateia-api-31dp.onrender.com/health](https://plateia-api-31dp.onrender.com/health) |
| Banco de dados | PostgreSQL gerenciado | Acesso privado                                                                       |

A aplicação web está configurada para consumir a API publicada. A API restringe o CORS à origem do front-end e utiliza variáveis de ambiente próprias para o banco de dados, JWT e integração com a Ticketmaster.

### Avaliação em produção

As contas apresentadas na seção [Dados de demonstração](#dados-de-demonstração) também podem ser utilizadas no ambiente publicado.

Na primeira requisição após um período de inatividade, a API hospedada no Render pode apresentar um tempo de resposta maior devido à inicialização do serviço. Após esse primeiro acesso, as requisições seguintes tendem a responder normalmente.

Para despertar a API antes da demonstração, acesse:

```text
https://plateia-api-31dp.onrender.com/health
```

Resposta esperada:

```json
{
  "status": "ok"
}
```

### Atualização dos ambientes

Os deploys estão vinculados ao repositório:

- novos pushes na branch principal acionam a publicação da API no Render;
- novos pushes na branch principal acionam a publicação do front-end na Vercel;
- as verificações de qualidade são executadas pelo GitHub Actions.

Os segredos e as credenciais de produção não são versionados. Eles são configurados diretamente nas plataformas de hospedagem.

## Licença

Este projeto adota a [licença MIT](LICENSE).

## Autor - Arthur Vinicius Carneiro Nunes

- GitHub: [ArthurViniNunes](https://github.com/ArthurViniNunes)
- Repositório: [ArthurViniNunes/plateia](https://github.com/ArthurViniNunes/plateia)
