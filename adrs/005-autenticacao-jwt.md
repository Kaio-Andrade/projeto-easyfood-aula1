# ADR-005 — Proteger operações privadas com JWT

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Data** | 2026-11-10 |
| **Autores** | Equipe EasyFood |

## Contexto

O cadastro de restaurantes e as alterações de perfil e cardápio precisam identificar o usuário que está realizando a operação. Enviar um ID de usuário no corpo da requisição permitiria que o cliente tentasse agir como outra pessoa.

## Alternativas consideradas

1. Manter todas as rotas públicas.
2. Enviar o identificador do usuário em cada requisição.
3. Autenticar com JWT e obter a identidade a partir de um token assinado.

## Decisão

Usar JWT para autenticação. O middleware valida o Bearer token e disponibiliza o identificador autenticado em `req.user.id`. Operações privadas não recebem a identidade do usuário a partir de campos controlados pelo cliente.

Para operações sobre restaurantes e pratos, os Services também validam se o recurso pertence ao usuário autenticado.

## Justificativa

- O token assinado permite validar a identidade sem confiar em um ID enviado no corpo.
- Um middleware comum protege rotas de diferentes módulos.
- O fluxo se integra ao cadastro e login já existentes.

## Consequências

### Positivas

- Rotas privadas compartilham a mesma validação de autenticação.
- A imagem de perfil é associada ao usuário identificado pelo token.
- A identidade fica disponível aos Controllers e Services de forma uniforme.

### Negativas

- A chave `JWT_SECRET` precisa ser configurada e protegida.
- Tokens têm validade e precisam ser renovados após expiração.
- Autenticação não substitui autorização específica por recurso quando o domínio exigir propriedade ou papéis.

## Critérios de revisão

Reavaliar se forem necessários logout com revogação, renovação de sessão, papéis ou autorização granular.

## Notas

- O payload guarda o identificador em `sub`; o middleware converte esse valor para `req.user.id`.
- Rotas de upload aplicam autenticação antes do middleware Multer.
