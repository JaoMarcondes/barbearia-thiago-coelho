# Supabase — login do cliente com WhatsApp + senha

O cliente vê apenas **WhatsApp + senha**. O site transforma o número em um e-mail técnico interno para usar o Supabase Auth sem SMS.

## 1. Banco

No SQL Editor, execute uma vez:

`supabase/clientes-auth.sql`

Ele cria/atualiza `customers` e liga os novos agendamentos ao cliente por `bookings.customer_id`.

## 2. Authentication

Em **Authentication > Sign In / Providers**:

- **Phone**: desativado.
- **Email**: ativado.
- **Confirm email**: desativado para este fluxo.

Não é necessário configurar Twilio, SMS nem SMTP para o login.

O cliente digita `(19) 99999-9999`, mas internamente o Auth usa algo no formato `5519999999999@clientes.barbearia.local`. O endereço técnico nunca é mostrado ao cliente.

## 3. Importante para produção

Como não há verificação por SMS, o sistema não comprova automaticamente que o número pertence à pessoa. Para um site em produção, implemente depois uma recuperação/verificação de conta adequada.

## 4. Promoções

O campo `whatsapp_opt_in` continua existindo porque campanhas iniciadas pela empresa precisam respeitar autorização do cliente e as regras do WhatsApp/Meta.
