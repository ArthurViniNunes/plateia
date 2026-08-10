# ADR 0008 — Adotar MUI com identidade editorial própria

- **Status:** Aceito
- **Data:** 2026-08-10
- **Responsável pela decisão:** Arthur Vinicius Carneiro Nunes

## Contexto

O enunciado valoriza uma interface bem-feita, agradável e autoral, e alerta contra interfaces reconhecíveis como resultado genérico de ferramentas. O prazo não favorece construir do zero todos os elementos interativos necessários, sobretudo formulários, feedback de erros, diálogos, estados de carregamento e controles acessíveis.

## Forças de decisão

- acelerar componentes funcionais e acessíveis;
- manter consistência entre as três jornadas;
- produzir identidade própria, não aparência padrão da biblioteca;
- suportar responsividade e estados de interação;
- concentrar esforço autoral em hierarquia, composição e comportamento.

## Alternativas consideradas

### CSS Modules sem biblioteca de componentes

Oferece controle visual máximo, mas exige implementar e validar mais componentes básicos dentro do prazo.

### Tailwind CSS

Permite composição rápida e autoral. Exigiria, porém, definir ou incorporar separadamente componentes complexos e seus comportamentos de acessibilidade.

### Styled Components

É flexível, mas não resolve por si só a biblioteca de componentes, e adicionaria outra camada de runtime sem necessidade clara.

### MUI com tema padrão

É rápido, porém produziria exatamente a aparência genérica que o desafio pede para evitar.

## Decisão

Usar MUI como base de componentes e criar um tema próprio com direção editorial cultural, clara e expressiva. A identidade será construída por tipografia, ritmo de espaços, cores, superfícies, iconografia, composição de cards e estados visuais coerentes.

A interface não copiará Ingresso.com, Eventim ou Sympla. Essas referências serão usadas apenas para compreender padrões de jornada. As decisões visuais deverão favorecer leitura, seleção de assentos e clareza de estados, e não apenas ornamentação.

## Consequências positivas

- componentes complexos podem ser implementados com mais rapidez;
- estados de foco, teclado e responsividade partem de uma base madura;
- tema centralizado reduz inconsistências;
- sobra mais tempo para o mapa de assentos e feedbacks de negócio;
- identidade pode ser explicada como decisão consciente.

## Consequências negativas e riscos

- componentes podem manter aparência reconhecível do MUI se pouco customizados;
- bundle tende a ser maior que uma solução mínima;
- uso excessivo de propriedades locais pode fragmentar o design;
- estética editorial pode prejudicar densidade em telas operacionais, como portaria;
- personalização visual não garante acessibilidade automaticamente.

## Medidas de mitigação

- definir tokens no tema antes de espalhar estilos locais;
- criar poucos componentes de composição próprios;
- testar contraste, foco visível, teclado e diferentes larguras;
- preservar alta clareza e velocidade na tela de portaria;
- justificar padrões importantes no README e evitar efeitos sem função.

## Gatilhos para reconsideração

- limitações do MUI impedirem o comportamento necessário do mapa;
- bundle comprometer metas reais de desempenho;
- testes com usuários mostrarem baixa legibilidade;
- identidade continuar visualmente indistinguível do tema padrão;
- adoção futura de um design system corporativo incompatível.
