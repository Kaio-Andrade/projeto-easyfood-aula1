# ADR-007 — Gerenciar pratos e processar imagens na API EasyFood

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Data** | 2026-11-10 |
| **Autores** | Equipe EasyFood |

## Contexto

Restaurantes precisam cadastrar pratos associados ao próprio cardápio. Os pratos podem receber imagens, que devem ser reduzidas e armazenadas. O volume inicial é limitado e a aplicação já executa em um servidor Node.js.

## Alternativas consideradas

1. Processar imagens dentro da API EasyFood.
2. Criar um serviço independente para processamento.
3. Usar funções Serverless/FaaS ou processamento em fila.

## Decisão

Criar o módulo `dishes`, relacionar cada prato a um restaurante no PostgreSQL e processar imagens dentro da API com Sharp. O caminho resultante é persistido no campo `imageUrl`.

## Justificativa

- Mantém a solução simples para o volume e o contexto acadêmico atuais.
- Reutiliza a infraestrutura já disponível na API.
- Evita configurar filas, microsserviços e deploys independentes antes de haver essa necessidade.

## Consequências

### Positivas

- Cadastro de pratos e consulta do cardápio ficam organizados em módulo próprio.
- O relacionamento relacional garante que cada prato pertença a um restaurante existente.
- O restaurante registra seu proprietário; os Services verificam essa relação antes de permitir alterações no cardápio.
- A imagem otimizada é servida pelo próprio aplicativo.

### Negativas

- Processar imagens consome CPU e memória do servidor da API.
- A disponibilidade das imagens depende do armazenamento local do servidor.
- O caminho público exige avaliar controle de acesso caso as imagens deixem de ser públicas.

## Critérios de revisão

Reavaliar armazenamento externo, fila ou processamento independente se volume, tamanho dos arquivos ou impacto na latência crescerem.

## Notas

- A validação do prato normaliza o preço para duas casas decimais e verifica a existência do restaurante antes da gravação.
- A imagem é opcional para que uma falha no upload não apague o prato já cadastrado.
