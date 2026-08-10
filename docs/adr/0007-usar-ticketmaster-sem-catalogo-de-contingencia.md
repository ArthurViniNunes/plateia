# ADR 0007 — Usar Ticketmaster sem catálogo de contingência

- **Status:** Aceito
- **Data:** 2026-08-10
- **Responsável pela decisão:** Arthur Vinicius Carneiro Nunes

## Contexto

O organizador deve iniciar a criação de um evento a partir de um catálogo externo. Entre Ticketmaster Discovery e TMDb, foi escolhida a Ticketmaster por sua proximidade com o domínio de eventos. Também foi discutido se a aplicação deveria usar dados locais quando a API estivesse indisponível.

## Forças de decisão

- demonstrar integração real, inclusive tratamento de falhas;
- evitar que dados de contingência escondam problemas de configuração;
- manter clara a origem do item selecionado;
- não duplicar catálogo remoto no escopo atual;
- apresentar erro compreensível ao organizador.

## Alternativas consideradas

### TMDb

É apropriada para filmes, mas restringe o catálogo a uma parte do domínio pretendido. Ticketmaster oferece eventos mais próximos da jornada de ingressos.

### Ticketmaster com catálogo local de contingência

Tornaria a demonstração mais resiliente, mas poderia mascarar chave ausente, limite excedido ou indisponibilidade e criar duas fontes com comportamentos diferentes.

### Criação completamente manual

Reduz dependência externa, porém não atende ao requisito de montar o evento a partir de catálogo externo.

## Decisão

Consumir a Ticketmaster Discovery API por meio do back-end. Sem chave válida, em caso de indisponibilidade ou falha relevante da Ticketmaster, a aplicação exibirá erro claro e impedirá a criação baseada no catálogo. Não haverá catálogo local de contingência em execução normal.

Testes automatizados poderão substituir a fronteira HTTP por respostas controladas. Isso é isolamento de teste, não fallback de produção.

## Consequências positivas

- falhas de configuração ficam visíveis;
- há uma única origem de catálogo em produção;
- credenciais permanecem no back-end;
- contratos e erros da integração podem ser testados de forma explícita;
- a decisão evita manter dados locais potencialmente divergentes.

## Consequências negativas e riscos

- a criação de eventos depende de rede, disponibilidade e limites externos;
- o avaliador precisará configurar uma chave válida;
- uma falha externa pode impedir a demonstração dessa jornada;
- mudanças no contrato remoto podem quebrar a integração;
- resultados podem variar conforme região e data.

## Medidas de mitigação

- documentar obtenção e configuração da chave;
- validar a variável de ambiente na inicialização ou antes do uso;
- usar timeout e mapear erros externos para mensagens próprias;
- não expor a chave ao navegador;
- semear ao menos um evento já publicado, conforme exigido pelo desafio, para permitir avaliar compra e portaria sem recriar todo o fluxo.

## Gatilhos para reconsideração

- exigência de funcionamento offline;
- indisponibilidade recorrente comprometer o produto;
- termos ou limites da API inviabilizarem o uso;
- necessidade de agregar outras fontes de catálogo;
- avaliação demonstrar que a ausência de fallback prejudica desproporcionalmente a experiência.
