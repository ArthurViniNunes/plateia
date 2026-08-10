# ADR 0001 — Adotar monorepo com TypeScript ponta a ponta

- **Status:** Aceito
- **Data:** 2026-08-10
- **Responsável pela decisão:** Arthur Vinicius Carneiro Nunes

## Contexto

O Plateia possui front-end React, API Node.js e contratos de dados consumidos por ambos. O desafio tem prazo curto, mas será avaliado também pela organização do código, pela clareza das decisões e pela capacidade de executar o fluxo completo. Separar o projeto em repositórios independentes aumentaria a coordenação de versões e duplicaria parte da configuração. Manter tudo em uma única aplicação, por outro lado, misturaria responsabilidades que possuem ciclos de execução distintos.

## Forças de decisão

- compartilhar contratos sem copiá-los entre front-end e back-end;
- executar instalação, testes e build a partir de uma raiz única;
- preservar limites explícitos entre interface, API e código compartilhado;
- reduzir trabalho operacional durante o prazo do desafio;
- manter o histórico de decisões e entregas em um único repositório público.

## Alternativas consideradas

### Repositórios separados

Oferecem isolamento forte e pipelines independentes, mas introduzem coordenação de versões e publicação de pacotes compartilhados sem benefício proporcional para o escopo atual.

### Uma única aplicação sem workspaces

É simples no início, porém facilita acoplamento entre front-end e back-end e dificulta comandos agregados e contratos compartilhados.

### Monorepo com ferramenta dedicada, como Nx ou Turborepo

Traz cache, grafo de tarefas e recursos úteis em bases maiores. Para três workspaces e um prazo de três dias, adicionaria configuração e conceitos que ainda não resolvem um problema observado.

## Decisão

Adotar um monorepo gerenciado por npm workspaces, organizado da seguinte forma:

```text
apps/api
apps/web
packages/contracts
```

Usar TypeScript no front-end, no back-end e nos contratos compartilhados. A raiz será privada no npm e agregará os comandos presentes nos workspaces.

## Consequências positivas

- contratos podem ser compartilhados com verificação estática;
- um único `package-lock.json` torna a instalação reproduzível;
- comandos de teste, build e lint podem ser executados na raiz;
- o avaliador encontra todo o processo e a documentação em um único histórico;
- a estrutura permite crescer sem antecipar uma plataforma de monorepo mais complexa.

## Consequências negativas e riscos

- mudanças na raiz podem afetar mais de um workspace;
- dependências podem ser içadas, ocultando importações declaradas incorretamente;
- scripts agregados precisam respeitar diferenças entre os workspaces;
- o pacote de contratos pode virar um depósito de abstrações prematuras.

## Medidas de mitigação

- declarar dependências no workspace que efetivamente as utiliza;
- manter contratos apenas quando houver consumo real por mais de uma aplicação;
- executar testes e typecheck por workspace e também pela raiz;
- evitar adicionar ferramentas de monorepo antes de existir necessidade mensurável.

## Gatilhos para reconsideração

- pipelines independentes se tornarem necessários;
- tempo de execução dos comandos agregados se tornar um gargalo;
- equipes autônomas precisarem versionar e publicar componentes separadamente;
- o compartilhamento de dependências causar conflitos frequentes.
