# WhatsApp com Python + Meta Cloud API

A integração da Twilio foi removida. O painel envia campanhas por um backend Python/Flask usando a API oficial do WhatsApp da Meta.

## Como funciona

`Cliente cria conta -> Supabase customers -> Barbeiro cria campanha -> Python -> Meta WhatsApp Cloud API -> cliente`

O painel do barbeiro possui:

- **Nome da mensagem**
- **Descrição**

O backend consulta `public.customers` e envia somente para quem aceitou promoções durante o cadastro (`whatsapp_opt_in = true`). Essa opção não aparece novamente na tela de agendamento.

## 1. Atualize o banco

No SQL Editor do Supabase, execute:

`supabase/clientes-auth.sql`

Esse arquivo cria a tabela de clientes, registra o consentimento para WhatsApp e liga novos agendamentos ao cliente autenticado.

O antigo `supabase/whatsapp-python.sql` ficou apenas como referência de compatibilidade.

## 2. Crie o template na Meta

Crie um template de categoria **Marketing**, idioma **Português (Brasil)**, com duas variáveis no corpo. Exemplo:

```text
🔥 {{1}}

{{2}}

Agende seu horário conosco.
```

Depois de aprovado, coloque o nome técnico desse template em `WHATSAPP_TEMPLATE_NAME`.

## 3. Configure o backend

Copie:

`backend/.env.example` -> `backend/.env`

Preencha no `.env`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_TEMPLATE_NAME`

**Nunca coloque o token da Meta no HTML, JavaScript ou GitHub.**

## 4. Instale o Python

No terminal, na raiz do projeto:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

## 5. Rode o backend

```powershell
.venv\Scripts\python.exe backend\app.py
```

Teste no navegador:

`http://127.0.0.1:5000/health`

Deve retornar:

```json
{"ok":true,"service":"barbearia-whatsapp-python"}
```

## 6. Rode o site

Abra o frontend com Live Server. A URL padrão do backend fica em `js/config.js` e durante o desenvolvimento é `http://127.0.0.1:5000`.

Quando o Python for hospedado, troque esse endereço pela URL HTTPS da hospedagem.

## Segurança e regras

- O endpoint Python valida a sessão do Supabase e exige conta `staff`.
- O token da Meta fica somente no backend.
- Campanhas usam template aprovado pela Meta.
- Somente clientes com autorização ativa entram na lista.
- O limite padrão por clique é 100 destinatários e pode ser alterado em `WHATSAPP_MAX_RECIPIENTS_PER_SEND`.
