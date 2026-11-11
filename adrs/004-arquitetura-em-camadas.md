# ADR-004 — Organizar a API em camadas e módulos

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Data** | 2026-11-10 |
| **Autores** | Equipe EasyFood |

## Contexto

Com a persistência, as rotas começaram a acumular validação, regras de negócio e acesso ao banco. Essa mistura dificulta compreender responsabilidades e evoluir funcionalidades sem afetar outras partes da API.

## Alternativas consideradas

1. Concentrar endpoints, regras e consultas em um único arquivo.
2. Separar por camadas — Routes, Controller, Service e Database — e organizar funcionalidades em módulos.
3. Dividir a aplicação em serviços independentes.

## Decisão

Adotar um monólito modular em camadas. Routes declaram caminhos e middlewares; Controllers traduzem HTTP; Services implementam regras e coordenam persistência; `src/database` mantém a conexão Prisma. Funcionalidades relacionadas ficam em módulos próprios.

## Justificativa

- A separação reduz o acoplamento entre HTTP, regras de negócio e banco.
- O monólito é simples de executar e adequado ao volume e ao contexto acadêmico.
- A organização permite adicionar módulos sem distribuir a aplicação em múltiplos deploys.

## Consequências

### Positivas

- Cada camada tem uma responsabilidade clara.
- Regras podem ser reutilizadas por mais de uma rota.
- Mudanças de persistência ficam concentradas nos Services e na camada Database.

### Negativas

- Há mais arquivos e convenções para manter.
- A equipe precisa evitar mover regras de negócio para Controllers ou Routes.

## Critérios de revisão

Reavaliar a divisão dos módulos se surgirem necessidades de escala, autonomia de deploy ou isolamento operacional que o monólito não atenda.

## Notas

- A implementação separa `auth`, `restaurants`, `dishes` e `shared` dentro de `src/modules`; o frontend servido pelo Express fica em `public/`, com CSS e módulos JavaScript separados.
