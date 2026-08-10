# ADR 0004 — Modelar autenticação com três papéis

- **Status:** Aceito
- **Data:** 2026-08-10
- **Responsável pela decisão:** Arthur Vinicius Carneiro Nunes

## Contexto

O Plateia possui três jornadas com permissões distintas: o organizador cria e gerencia eventos; o cliente reserva, paga e consulta ingressos; a portaria valida ingressos na entrada. O enunciado exige autenticação com esses papéis e dados semeados que permitam avaliar o fluxo sem configurar tudo do zero.

## Forças de decisão

- impedir que uma interface escondida seja tratada como controle de acesso;
- permitir demonstração rápida com usuários conhecidos;
- evitar cadastro público de perfis privilegiados;
- manter uma única identidade por usuário no MVP;
- tornar permissões verificáveis por testes na API.

## Alternativas consideradas

### Cadastro público para todos os papéis

Simplifica a demonstração de criação de contas, mas permitiria que qualquer pessoa se tornasse organizador ou portaria sem um processo administrativo definido.

### Somente contas semeadas

É rápido para avaliação, porém não oferece a jornada de entrada de um novo cliente.

### Aplicações ou tabelas de usuário separadas

Isolam os perfis, mas duplicam autenticação e dados comuns sem necessidade demonstrada no MVP.

## Decisão

Modelar uma identidade autenticável com três papéis exclusivos: `ORGANIZER`, `CUSTOMER` e `GATEKEEPER`.

- clientes podem realizar cadastro público;
- organizador e portaria são criados pelo seed;
- autorização é aplicada no back-end para cada operação protegida;
- o front-end apresenta jornadas compatíveis com o papel, sem ser a fonte de segurança.

O mecanismo de sessão, o algoritmo de hash de senha e a estratégia de revogação ainda serão decididos antes da implementação da autenticação. Este ADR define papéis e política de provisionamento, não antecipa essas escolhas.

## Consequências positivas

- o avaliador consegue acessar as três jornadas imediatamente;
- perfis privilegiados não podem ser criados publicamente;
- regras de autorização permanecem centralizadas na API;
- uma tabela de identidade reduz duplicação no escopo atual.

## Consequências negativas e riscos

- papel exclusivo não atende um usuário que precise acumular funções;
- contas semeadas exigem credenciais de demonstração claramente documentadas;
- dados conhecidos de demonstração não podem ser reutilizados em produção real;
- autenticação simples pode ocultar necessidades futuras de administração de usuários.

## Medidas de mitigação

- limitar seeds ao ambiente apropriado;
- armazenar apenas hashes de senha;
- testar autorização negativa, não apenas caminhos permitidos;
- documentar que as credenciais são exclusivamente demonstrativas;
- criar novo ADR caso múltiplos papéis por usuário se tornem necessários.

## Gatilhos para reconsideração

- organizadores precisarem cadastrar membros de equipe;
- um usuário precisar exercer mais de um papel;
- surgir administração real de contas privilegiadas;
- requisitos de autenticação federada ou multifator forem introduzidos.
