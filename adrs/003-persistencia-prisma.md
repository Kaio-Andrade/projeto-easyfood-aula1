# ADR-003 — Gerenciar a persistência com Prisma ORM

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Data** | 2026-11-10 |
| **Autores** | Equipe EasyFood |

## Contexto

Depois da escolha do PostgreSQL registrada na ADR-002, a aplicação precisa mapear os modelos do domínio para tabelas, executar consultas com segurança e evoluir o schema sem depender de alterações manuais não versionadas.

## Alternativas consideradas

1. Escrever SQL e gerenciar scripts de banco manualmente.
2. Usar um query builder, como Knex.
3. Usar um ORM com schema e migrations, como Prisma.

## Decisão

Adotar Prisma ORM para definir os modelos, gerar o Prisma Client e versionar mudanças do banco com migrations.

## Justificativa

- Mantém o schema da aplicação explícito e revisável no repositório.
- Gera consultas tipadas e reduz SQL repetitivo nos serviços.
- As migrations registram a evolução do PostgreSQL.
- Integra-se diretamente ao Node.js usado pela EasyFood.

## Consequências

### Positivas

- Modelos e relações ficam centralizados em `prisma/schema.prisma`.
- O Prisma Client reduz erros de nomes e formatos nas consultas.
- É possível reproduzir a evolução do banco por migrations.

### Negativas

- O projeto passa a depender do Prisma CLI e do Prisma Client.
- Alterações do schema exigem geração do client e migration compatível com o banco.
- Consultas muito específicas podem exigir SQL manual.

## Critérios de revisão

Reavaliar se limitações de desempenho, consultas específicas ou requisitos de portabilidade tornarem o ORM inadequado.

## Notas

- As migrations adicionam `Dish`, `Activity`, o relacionamento de propriedade entre `User` e `Restaurant`, a categoria do prato e `imageUrl` opcional em `User` e `Dish`.
- A migration precisa ser aplicada com PostgreSQL ativo antes de testar operações no banco.
