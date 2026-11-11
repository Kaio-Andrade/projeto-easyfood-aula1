# ADR-008 — Reutilizar o processamento de imagens em um serviço compartilhado

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Data** | 2026-11-10 |
| **Autores** | Equipe EasyFood |

## Contexto

A Atividade 8 adiciona imagem de perfil ao usuário, enquanto os pratos também recebem imagens. Implementar Multer, Sharp, validação, conversão e armazenamento separadamente em `auth` e `dishes` duplicaria lógica e poderia produzir formatos e limites diferentes.

## Alternativas consideradas

1. Repetir o processamento em cada módulo.
2. Compartilhar apenas o middleware de upload e duplicar o processamento.
3. Compartilhar o recebimento e concentrar transformação e armazenamento em `src/modules/shared/image.service.js`.
4. Delegar o processamento a um serviço remoto.

## Decisão

Usar um middleware Multer compartilhado para receber um único arquivo em memória, com limite de 5 MB e formatos JPEG, PNG ou WebP. Usar `image.service.js` para validar o conteúdo com Sharp, corrigir orientação, redimensionar, converter para WebP e armazenar. Os módulos de autenticação e pratos chamam esse serviço e salvam o caminho retornado no PostgreSQL.

## Justificativa

- A mesma regra de processamento atende imagens de perfil e de pratos.
- Multer trata a entrada multipart; Services dos módulos tratam a entidade e a persistência; o serviço compartilhado trata a transformação do arquivo.
- O limite e a validação reduzem risco de consumo excessivo e de formatos inesperados.
- A solução permanece dentro da API, conforme a ADR-007.

## Consequências

### Positivas

- A transformação é implementada uma vez e reutilizada por diferentes módulos.
- A identidade do perfil vem do JWT, nunca de um ID enviado pelo cliente.
- O caminho da imagem fica consultável em `/auth/me` ou na consulta do cardápio.
- Falhas de processamento retornam erro sem remover o usuário ou prato existente; falha ao atualizar o banco remove o arquivo recém-criado.

### Negativas

- O armazenamento local precisa ser mantido e incluído no planejamento de backup/deploy.
- As imagens servidas em `/uploads` são públicas nesta versão.
- A memória é usada para receber o arquivo antes de o Sharp processá-lo, limitada pelo tamanho máximo configurado.

## Critérios de revisão

Reavaliar limites, armazenamento e exposição pública antes de produção ou se forem necessários arquivos privados, CDN, processamento em lote ou maior volume.

## Notas

- O middleware de referência recebido segue o contrato adotado: `memoryStorage`, um arquivo, limite de 5 MB e filtro MIME para JPEG, PNG e WebP. Sharp também valida o conteúdo real do arquivo.
- O middleware de autenticação executa antes de Multer nas rotas protegidas.
