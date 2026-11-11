# ADR-006 — Centralizar o envio de e-mails em um serviço compartilhado

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Data** | 2026-11-10 |
| **Autores** | Equipe EasyFood |

## Contexto

As funcionalidades de cadastro podem precisar enviar mensagens diferentes, como confirmação ao usuário e notificação interna. Repetir a integração com o provedor em cada módulo acoplaria regras de negócio à infraestrutura de e-mail.

## Alternativas consideradas

1. Cada módulo integrar diretamente com o provedor.
2. Concentrar envio e configuração em um serviço compartilhado.
3. Introduzir uma fila e um serviço de mensagens independente.

## Decisão

Usar um serviço compartilhado de e-mail dentro do monólito para encapsular a integração com o provedor. Os módulos chamam o serviço com destinatário e conteúdo; não dependem diretamente do SDK do provedor.

## Justificativa

- Evita duplicar a integração e o tratamento de configuração.
- Mantém Controllers e regras do módulo desacoplados do provedor.
- Uma fila acrescentaria infraestrutura desnecessária para o volume atual.

## Consequências

### Positivas

- Trocar ou configurar o provedor fica concentrado no serviço compartilhado.
- Diferentes módulos podem reutilizar o mesmo contrato de envio.
- Falhas de uma notificação secundária podem ser tratadas sem desfazer o cadastro principal.

### Negativas

- O serviço compartilhado passa a ser dependência comum dos módulos que enviam mensagens.
- O envio síncrono pode aumentar o tempo de resposta e falhas do provedor precisam ser isoladas.
- Sem fila, mensagens não são automaticamente repetidas se o processo cair.

## Critérios de revisão

Reavaliar o envio assíncrono quando volume, latência ou necessidade de repetição confiável justificarem fila e processamento independente.

## Notas

- Esta decisão registra o padrão ensinado na Atividade 6: encapsular a integração no serviço compartilhado e proteger a operação principal contra falhas de notificações secundárias.
