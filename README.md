# EasyFood

Aplicação de restaurantes e cardápios com Node.js, Express, PostgreSQL e Prisma 6. A interface em português permite criar uma conta, entrar, cadastrar restaurantes, consultar cardápios e gerenciar pratos e imagens do próprio restaurante. O usuário autenticado também pode atualizar sua imagem de perfil.

O frontend é servido pelo próprio backend. Não há instalação ou build separado para a interface.

## Requisitos

- Git.
- Node.js 24 LTS e npm, para executar fora do container.
- Docker Engine/Desktop com Docker Compose v2, para os roteiros abaixo.

## Preparar a configuração

```bash
git clone https://github.com/Kaio-Andrade/projeto-easyfood-aula1.git
cd projeto-easyfood-aula1
```

Copie o arquivo de exemplo. No Linux, macOS ou Git Bash:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Gere a chave usada para assinar os tokens de autenticação:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Cole o resultado em `JWT_SECRET` no `.env`. Para gerar a chave sem ter Node instalado, use:

```bash
docker run --rm node:24-bookworm-slim node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

As credenciais PostgreSQL do exemplo (`postgres`/`postgres`) são para desenvolvimento local. A chave JWT não deve ser compartilhada entre ambientes. O `.env` está ignorado pelo Git e não é copiado para a imagem Docker.

## Opção A: tudo pelo Docker Compose

Com o Docker ativo e o `.env` preparado:

```bash
docker compose up --build -d
docker compose ps -a
```

O Compose inicia o PostgreSQL, espera o banco aceitar conexões, executa as migrations e inicia a aplicação. O serviço `migrate` deve terminar com código `0`; a aplicação deve ficar `healthy`.

Abra **http://localhost:3000**. Se definir outro `PORT` no `.env`, utilize essa porta no navegador.

Para acompanhar o início ou investigar uma falha:

```bash
docker compose logs -f app migrate db
```

Os dados de exemplo são opcionais e não são criados automaticamente:

```bash
docker compose exec app npm run seed
```

Com os valores padrão do `.env`, entre com `demo@easyfood.local` e senha `easyfood123`. O seed cria três restaurantes pertencentes a esse usuário, mas não cria pratos. Para verificar um banco já preparado:

```bash
docker compose exec app npm run db:status
```

Para parar os serviços preservando os dados e imagens:

```bash
docker compose down
```

Na próxima execução:

```bash
docker compose up -d
```

Os volumes `postgres_data` e `uploads` preservam, respectivamente, o banco e as imagens. A opção `down -v` remove esses volumes e seus dados.

## Opção B: Node local e banco em Docker

Depois de preparar o `.env`, inicie apenas o banco:

```bash
docker compose up -d db
docker compose exec db pg_isready -U postgres -d easyfood
```

O resultado esperado contém `accepting connections`. Se alterou `POSTGRES_USER` ou `POSTGRES_DB`, ajuste o comando de verificação.

Instale as dependências e prepare o Prisma:

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run db:status
```

Opcionalmente, carregue os dados de exemplo:

```bash
npm run seed
```

Inicie a aplicação:

```bash
npm start
```

Abra **http://localhost:3000**. Durante o desenvolvimento, `npm run dev` reinicia o servidor quando o código muda.

Use um dos roteiros por vez: executar a aplicação local e a aplicação do Compose na mesma porta causa conflito. Se já tiver PostgreSQL instalado, crie um banco vazio chamado `easyfood`, configure `DATABASE_URL` e dispense o serviço `db`.

## Configuração

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão usada pelo Node local e pelos comandos Prisma locais. |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Credenciais e nome do banco criado pelo Compose. A conexão da aplicação no container é montada com esses valores e host `db`. |
| `POSTGRES_PORT` | Porta local do PostgreSQL, por padrão 5432. A publicação do banco fica restrita a `127.0.0.1`. |
| `PORT` | Porta da aplicação local ou porta publicada pelo Compose, por padrão 3000. |
| `JWT_SECRET` | Chave obrigatória para assinar/verificar JWT. |
| `EMAIL_ENABLED` | `false` desativa notificações; `true` habilita o Resend. |
| `EMAIL_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` | Chave, endereço e nome do remetente das notificações. |
| `EMAIL_TO` | Destinatário opcional da notificação comercial sobre novos restaurantes. |
| `SEED_USER_EMAIL`, `SEED_USER_PASSWORD` | Credenciais do usuário de demonstração criado pelo seed. |

Ao alterar as credenciais ou a porta do banco, atualize também a `DATABASE_URL` para o uso local. No Compose, prefira uma senha aleatória composta por caracteres seguros para URL, como o resultado hexadecimal do gerador acima. Em uma conexão configurada manualmente, caracteres reservados de usuário/senha precisam de codificação percentual.

Mudar `POSTGRES_PASSWORD` no `.env` não altera a senha de um banco já inicializado em um volume. Essa alteração exige atualizar o usuário no PostgreSQL e depois a configuração dos clientes.

## Usar a interface

1. Cadastre um usuário com e-mail válido e senha de pelo menos oito caracteres, ou entre com o usuário de demonstração após executar o seed.
2. Consulte os restaurantes e selecione um para abrir o cardápio.
3. Cadastre seu restaurante. Ele ficará vinculado à sua conta.
4. No seu restaurante, crie pratos com nome, categoria, descrição e preço de pelo menos R$ 0,01, com até duas casas decimais.
5. Edite ou exclua seus pratos e envie suas imagens pela interface.
6. Atualize sua imagem de perfil pela área da conta.

As alterações de pratos são permitidas apenas ao proprietário do restaurante. Os restaurantes do seed pertencem ao usuário de demonstração. Não há edição/exclusão de restaurantes nesta versão.

Imagens aceitas: **JPEG, PNG e WebP de até 5 MB**. O backend valida o conteúdo, converte para WebP e limita as dimensões a 1200 × 1200, mantendo a proporção. A pasta `uploads/` é criada automaticamente no uso local; no Compose, utiliza um volume persistente.

## E-mails reais com Resend

O sistema funciona com `EMAIL_ENABLED=false`, sem fazer chamadas ao provedor de e-mail.

Para habilitar as notificações:

1. Crie uma chave de API no Resend.
2. Valide um domínio remetente e configure os registros DNS solicitados pelo serviço.
3. Configure as variáveis no `.env` local ou no gerenciador de segredos da hospedagem:

```dotenv
EMAIL_ENABLED="true"
EMAIL_API_KEY="SUA_CHAVE_DO_RESEND"
EMAIL_FROM="notificacoes@seu-dominio.com"
EMAIL_FROM_NAME="EasyFood"
EMAIL_TO="comercial@seu-dominio.com"
```

O usuário que cadastra um restaurante recebe o e-mail de boas-vindas. `EMAIL_TO` recebe uma segunda notificação, se configurado. Reinicie o Node ou execute `docker compose up -d --force-recreate app` após alterar a configuração.

A validação de envio real depende de uma chave e um remetente autorizado pelo Resend. Uma falha do provedor é registrada pelo backend e não desfaz o cadastro do restaurante.

## API

As respostas de erro usam JSON com a propriedade `error`. O login retorna um token; nas rotas protegidas, envie `Authorization: Bearer SEU_TOKEN`.

| Método e rota | Ação | Autorização |
|---|---|---|
| `GET /health` | Verificação da aplicação e conexão com o banco | Pública |
| `POST /auth/register` | Criar usuário | Pública |
| `POST /auth/login` | Entrar e obter JWT | Pública |
| `GET /auth/me` | Consultar usuário autenticado | JWT |
| `POST /auth/me/image` | Enviar imagem do perfil | JWT |
| `GET /restaurants` | Listar restaurantes | Pública |
| `POST /restaurants` | Criar restaurante | JWT |
| `GET /restaurants/:restaurantId/dishes` | Listar pratos | Pública |
| `POST /restaurants/:restaurantId/dishes` | Criar prato | Proprietário |
| `GET /dishes/:dishId` | Consultar prato | Pública |
| `PUT /dishes/:dishId` | Atualizar prato | Proprietário |
| `DELETE /dishes/:dishId` | Excluir prato | Proprietário |
| `POST /dishes/:dishId/image` | Enviar imagem do prato | Proprietário |

Exemplo de corpo JSON para criar ou atualizar um prato:

```json
{
  "name": "Prato executivo",
  "category": "Almoço",
  "description": "Arroz, feijão, salada e frango",
  "price": 25.50
}
```

No `PUT`, envie os quatro campos. Para upload, use `multipart/form-data` com campo **image** do tipo arquivo; deixe o cliente HTTP preencher o boundary do `Content-Type`.

## Testes

Os testes de validação e dos fluxos HTTP com serviços simulados rodam sem PostgreSQL:

```bash
npm test
```

Os testes de integração usam banco real e criam/removem seus próprios dados de teste. Use um banco separado de qualquer ambiente com dados importantes, com as migrations já aplicadas, e habilite-os explicitamente:

```bash
RUN_INTEGRATION_TESTS=1 npm run test:integration
```

No Windows PowerShell:

```powershell
$env:RUN_INTEGRATION_TESTS="1"
npm run test:integration
Remove-Item Env:RUN_INTEGRATION_TESTS
```

Configure a `DATABASE_URL` para o banco de teste antes desses comandos. Os testes de integração não enviam e-mails reais. Para revisar os alertas de dependências, execute `npm audit`.

O projeto mantém Prisma 6 e usa um override restrito de `deepmerge-ts` para `@prisma/config`, com a versão 8.0.2. A compatibilidade foi verificada com os comandos Prisma de validação e geração. Reavalie esse override ao atualizar o Prisma.

## Migrations e bancos existentes

`npm run db:migrate` aplica as migrations versionadas com `prisma migrate deploy`. O Prisma Client é gerado com `npm run db:generate`. Ao atualizar o projeto, instale as dependências, gere o cliente e aplique as novas migrations antes de iniciar a aplicação.

O procedimento de instalação foi preparado para banco vazio. Em um banco antigo, a migration `20261110010000_add_ownership_activity_and_dish_category` interrompe a execução se houver restaurantes e a quantidade de usuários for diferente de um. É necessário mapear explicitamente cada restaurante para seu proprietário e planejar a migração conforme o histórico já aplicado. Prepare um backup antes de migrar dados existentes.

## Publicação em uma hospedagem

O Dockerfile produz uma aplicação executada por um usuário sem privilégios de root e mantém a CLI do Prisma disponível para aplicar migrations no deploy. Para publicar:

1. Configure PostgreSQL e a `DATABASE_URL` na hospedagem.
2. Configure `JWT_SECRET`, `PORT` e, se necessário, as variáveis do Resend no gerenciador de segredos do serviço.
3. Execute `npx prisma migrate deploy` como etapa anterior ao início da aplicação.
4. Inicie a imagem Docker ou execute `npm start` após instalar dependências e gerar o Prisma Client.
5. Disponibilize HTTPS e utilize `GET /health` para monitoramento.
6. Monte armazenamento persistente em `/app/uploads`, ou adapte o armazenamento para um serviço de objetos se precisar de múltiplas instâncias.

O Compose incluído é uma configuração local de referência. Na hospedagem, planeje backup do banco e das imagens, mantenha o banco sem exposição pública e substitua as credenciais de demonstração. O seed só deve ser executado quando você desejar esses dados de exemplo.

## Solução de problemas

| Sintoma | Verificação |
|---|---|
| `Configure JWT_SECRET` ou erro de interpolação no Compose | Defina uma chave aleatória em `JWT_SECRET` no `.env`. |
| Prisma `P1001` | Confirme banco ativo, host, porta e `DATABASE_URL`. Dentro do Compose o host é `db`; no Node local é `localhost`. |
| Prisma `P1000` | Confira usuário e senha; um volume antigo conserva as credenciais com que foi criado. |
| Tabela inexistente / Prisma `P2021` | Aplique as migrations no mesmo banco usado pela aplicação. |
| Prisma Client não inicializado | Execute `npm run db:generate`. |
| Porta 5432 ocupada | Altere `POSTGRES_PORT` e a porta da `DATABASE_URL` local. |
| Porta 3000 ocupada | Ajuste `PORT` no `.env` ou encerre o outro servidor. |
| Resposta 401 | Faça login novamente e envie o Bearer token. |
| Resposta 403 ao alterar prato | Utilize a conta proprietária do restaurante. |
| Imagens desaparecem após novo deploy | Configure armazenamento persistente para `uploads/`. |
| Falha ao aplicar migration de proprietários | Planeje o mapeamento dos registros antigos; consulte a seção de migrations. |

O comando de entrada suportado é `npm start` (`server.js`). `teste.js` é um servidor legado e não acompanha a implementação atual.
