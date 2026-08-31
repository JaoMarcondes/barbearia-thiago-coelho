# Cadastro de cliente sem SMS e sem confirmação de e-mail

O cliente continua vendo apenas **WhatsApp + senha**. Internamente, o WhatsApp vira um identificador de e-mail técnico, mas nenhum e-mail é enviado.

## Configuração no Dashboard

- Authentication -> Sign In / Providers -> **Phone**: desativado.
- Authentication -> Sign In / Providers -> **Email**: ativado.
- Não é necessário encontrar/desativar "Confirm email" para este projeto: a função `register-client` cria a conta já confirmada no servidor.

## Publicar a função de cadastro

Dentro da pasta do projeto, já vinculada ao Supabase:

```powershell
npx.cmd supabase functions deploy register-client --no-verify-jwt
```

`--no-verify-jwt` é necessário porque o cadastro ocorre antes de o cliente estar logado.

A função usa `SUPABASE_SERVICE_ROLE_KEY` apenas dentro da Edge Function. Essa chave não deve ser colocada no HTML ou JavaScript do navegador.

## Banco de dados

Execute `supabase/clientes-auth.sql` no SQL Editor caso ainda não tenha executado a versão mais recente. O trigger cria a linha em `public.customers` quando a conta Auth é criada.

## Teste

1. Abra `cliente-login.html`.
2. Escolha `Criar conta`.
3. Digite nome, WhatsApp e uma senha com pelo menos 6 caracteres.
4. A função cria a conta já confirmada.
5. O site faz login automaticamente e abre `agendar.html`.
