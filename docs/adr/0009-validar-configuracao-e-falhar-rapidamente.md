# ADR 0009 — Validar configuração e falhar rapidamente

- **Status:** Aceito
- **Data:** 2026-08-10
- **Responsável pela decisão:** Arthur Vinicius Carneiro Nunes

## Contexto

A API depende de valores que variam entre desenvolvimento, testes e produção. Neste momento, a porta HTTP e a origem autorizada pelo CORS já são configurações externas. Futuramente, banco de dados, Ticketmaster e segredos de autenticação ampliarão esse conjunto.

Valores padrão silenciosos facilitariam o primeiro uso, mas poderiam fazer a aplicação iniciar com uma configuração diferente da pretendida. A ausência de validação também deslocaria a descoberta do problema para o momento em que uma funcionalidade dependente fosse utilizada.

## Forças de decisão

- detectar configuração inválida antes de aceitar requisições;
- manter valores operacionais fora do código-fonte;
- produzir erros próximos da causa;
- compartilhar um contrato tipado após a validação;
- evitar comportamento diferente causado por defaults implícitos;
- documentar as variáveis necessárias sem versionar segredos.

## Alternativas consideradas

### Valores padrão no código

Reduzem a configuração local, mas podem ocultar variáveis ausentes e iniciar o serviço com porta ou origem CORS não pretendidas.

### Leitura direta de `process.env`

Evita uma dependência adicional, porém espalha valores possivelmente ausentes pelo código e repete conversões e verificações.

### Validação manual

Atenderia ao escopo atual, mas tende a crescer em condicionais próprias conforme novas variáveis são adicionadas.

### Validação somente em produção

Facilitaria o desenvolvimento, mas criaria comportamentos diferentes entre ambientes e permitiria que erros fossem descobertos apenas no deploy.

## Decisão

Carregar variáveis locais com `dotenv` e validá-las centralmente com Zod antes de iniciar o servidor.

`PORT` e `CORS_ORIGIN` são obrigatórias em todos os ambientes. A porta deve ser um número inteiro entre 1 e 65535. A origem CORS deve ser uma origem URL válida, sem caminho adicional.

A aplicação deve falhar imediatamente quando a configuração for ausente ou inválida. O arquivo `.env` não será versionado; `.env.example` documentará apenas nomes e exemplos não sensíveis.

O CORS autoriza somente a origem configurada. Uma origem divergente pode receber a resposta HTTP, mas não recebe o cabeçalho que autoriza o navegador a acessar seu conteúdo. Requisições sem `Origin` permanecem possíveis para clientes não baseados em navegador.

## Consequências positivas

- falhas de configuração aparecem durante a inicialização;
- o restante da aplicação recebe valores validados e tipados;
- desenvolvimento e produção seguem a mesma política;
- segredos futuros podem permanecer fora do repositório;
- o contrato operacional fica visível no `.env.example`.

## Consequências negativas e riscos

- a aplicação não inicia até que todas as variáveis obrigatórias sejam fornecidas;
- novas variáveis exigem atualização coordenada do schema e da documentação;
- mensagens nativas de validação podem expor detalhes internos se forem publicadas sem tratamento;
- `dotenv` pressupõe um arquivo no diretório de execução durante o desenvolvimento;
- CORS não substitui autenticação ou autorização.

## Medidas de mitigação

- manter `.env.example` atualizado;
- testar entradas válidas, ausentes e malformadas;
- não registrar valores secretos em logs;
- documentar a criação do `.env` no README principal;
- aplicar autenticação e autorização independentemente da política de CORS;
- validar as variáveis antes de criar conexões ou iniciar o servidor.

## Gatilhos para reconsideração

- adoção de um serviço gerenciado de configuração ou segredos;
- necessidade de múltiplas origens por ambiente;
- execução em plataforma que injete configuração por mecanismo diferente;
- necessidade comprovada de defaults seguros para ferramentas locais;
- schema de configuração crescer a ponto de exigir divisão por módulos.
