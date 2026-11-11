# Atividade 8 — análise da correção e decisões

## Comparação com o repositório de referência

O projeto local estava na etapa anterior ao cardápio: não havia módulo `dishes` nem modelo `Dish`, portanto o endpoint de cadastro ainda não existia neste checkout. O repositório do professor contém `src/modules/dishes/dish.service.js` e valida os identificadores e os dados antes de gravar. O preço é convertido para número e normalizado com duas casas decimais antes de chegar ao Prisma; o serviço também confirma que o restaurante existe e devolve 404 quando não existe.

Outro detalhe necessário para integrar essa implementação é o formato do usuário autenticado. O token guarda o ID em `sub`. O middleware antigo repassava o payload sem criar `req.user.id`, enquanto handlers que usam `req.user.id` esperam esse campo. O middleware agora converte `sub` para `id`, como no repositório de referência.

## O que foi implementado

- `POST /restaurants/:restaurantId/dishes` valida nome, descrição, preço e restaurante, e responde 201.
- `GET /restaurants/:restaurantId/dishes` retorna os pratos com seus `imageUrl`.
- `POST /auth/me/image` e `POST /dishes/:dishId/image` exigem Bearer JWT e recebem o campo multipart `image`.
- Multer limita uploads a 5 MB e aceita JPEG, PNG e WebP. Sharp valida o conteúdo, corrige orientação, redimensiona para caber em 1200 × 1200 e grava WebP com qualidade 82.
- `image.service.js` é compartilhado por usuários e pratos. Se a gravação no banco falhar após o processamento, o arquivo novo é removido; se a imagem for substituída, a antiga é removida após a atualização.
- Os arquivos são publicados sob `/uploads`, e o banco guarda o caminho relativo.

## Responsabilidades

Routes conectam middleware e controller. Controllers convertem requisições em chamadas de serviço e respostas HTTP. Services contêm validação/regra de negócio e acesso ao Prisma. `image.service.js` concentra o processamento e armazenamento para não duplicar Sharp entre módulos.

## Limite da verificação

O schema foi validado e o Prisma Client foi gerado. A migration foi criada, mas não pôde ser aplicada nem foi possível testar endpoints com PostgreSQL: o banco configurado em `localhost:5432` não estava disponível (Prisma P1001). Execute `npx prisma migrate dev` quando o PostgreSQL estiver ativo.
