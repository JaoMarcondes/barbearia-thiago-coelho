# Coelho Barber — versão HTML + CSS + JavaScript + Supabase

Esta pasta é uma conversão do projeto React/TypeScript original para uma estrutura sem React/TanStack.

## Estrutura

- `index.html`
- `servicos.html`
- `produtos.html`
- `agendar.html`
- `contato.html`
- `css/style.css`
- `js/main.js`
- `js/servicos.js`
- `js/produtos.js`
- `js/agendar.js`
- `js/contato.js`
- `js/barbearia.js`
- `js/supabase.js`
- `supabase/migration.sql`
- `assets/favicon.png` (adicione aqui a logo original)

## Supabase

1. Abra `js/supabase.js`.
2. Preencha `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` com as credenciais públicas do seu projeto.
3. Execute `supabase/migration.sql` no SQL Editor do Supabase.
4. Para o navegador funcionar corretamente, rode o projeto por um servidor local (por exemplo Live Server), em vez de abrir o HTML diretamente com `file://`.

## Observação sobre a logo

O projeto original armazenava a logo por um asset hospedado pelo ambiente Lovable e o ZIP não contém o PNG original. Coloque a logo original em `assets/favicon.png` para manter a imagem exatamente igual.


## Configuração já aplicada

O `js/supabase.js` usa a URL de API do projeto:

`https://bhcmderbhmzqwlmfayhb.supabase.co`

e a chave publicável fornecida. As páginas HTML também carregam o SDK do Supabase antes dos módulos JavaScript.

> Não coloque a `service_role` key no frontend.


## Página inicial — Tipos de cortes

A página inicial inclui agora uma seção responsiva de tipos de cortes:
- Low Fade
- Mid Fade
- High Fade
- Taper Fade
- Corte Social
- Buzz Cut

Cada card direciona para `agendar.html`.

A seção de Serviços com os 6 cards continua logo abaixo, conectada ao Supabase.


## Ajuste mais recente

- Removida a seção "Tipos de cortes" da página inicial.
- A seção "Serviços" agora fica diretamente após o banner principal.
- Layout dos 6 serviços ajustado para seguir a referência enviada: 3 colunas por 2 linhas, cards escuros, preço em dourado e duração à direita.
- Os 6 serviços continuam aparecendo mesmo se o Supabase estiver temporariamente indisponível.
- URL e chave publicável do Supabase configuradas.


## Ajuste mais recente

- Todas as referências de logo foram padronizadas para `assets/favicon.png`.
- A página `agendar.html` foi refeita para seguir a referência enviada:
  - título AGENDAR;
  - campos escuros com bordas discretas;
  - labels douradas;
  - grade de horários em 5 colunas no desktop;
  - nome e telefone lado a lado;
  - observações em largura total;
  - responsividade para celular.


## Ajuste mais recente

- A página `servicos.html` foi refeita para seguir o layout da referência enviada.
- A lista de serviços agora mostra:
  - Corte de cabelo
  - Corte com tesoura
  - Cortes infantis
  - Barba
  - Barba com navalha
  - Aparar a barba
  - Alisamento de cabelo
  - Coloração de cabelo
- O visual foi ajustado com:
  - título grande;
  - descrição logo abaixo;
  - linhas separadas por borda;
  - preço "Sob consulta" em dourado;
  - duração abaixo do preço;
  - botão arredondado "Agendar" à direita.
- Mesmo sem Supabase, a página já exibe esses serviços por fallback local.


## Ajuste mais recente

- Removido o rodapé/aba inferior de todas as páginas.
- Horários da página `contato.html` atualizados:
  - Quinta-feira: 09:00–20:00
  - Sexta-feira: 09:00–21:00
  - Sábado: 08:00–17:00
  - Domingo: Fechado
  - Segunda-feira: Fechado
  - Terça-feira: 09:00–19:30
  - Quarta-feira: 09:00–19:30


## Área exclusiva do barbeiro

Foram adicionadas duas páginas que não aparecem no menu público:

- `barbeiro-login.html` — login privado;
- `barbeiro.html` — painel de agendamentos.

O painel permite:
- ver nome, telefone, serviço, data, horário e observações;
- filtrar por data e status;
- confirmar agendamento;
- cancelar agendamento;
- voltar um agendamento para pendente;
- encerrar a sessão.

### Segurança

A proteção não depende de esconder a URL. Ela usa:
1. Supabase Auth (e-mail + senha);
2. tabela `staff_users`;
3. Row Level Security (RLS) na tabela `bookings`.

Para ativar:

1. Execute `supabase/barbeiro-admin.sql` no SQL Editor.
2. Em `Authentication > Users`, crie a conta do barbeiro.
3. Copie o UUID desse usuário.
4. No SQL Editor, execute:

```sql
INSERT INTO public.staff_users (user_id)
VALUES ('UUID-DO-BARBEIRO');
```

Não coloque a `service_role` key no site.


## Logo clicável

As logos do site agora funcionam como atalho para `index.html`.
Isso inclui o cabeçalho das páginas públicas, a logo principal da home,
o login do barbeiro e o cabeçalho do painel administrativo.


## Painel do barbeiro — fluxo de confirmação

O painel agora funciona em duas áreas principais:

1. **Pendentes**
   - Todos os agendamentos com status `pendente` ficam sempre visíveis.
   - Eles aparecem independentemente da data selecionada.

2. **Agenda do dia**
   - Mostra apenas agendamentos `confirmado` da data escolhida.
   - Quando o barbeiro clica em **Confirmar**, o pedido:
     - sai automaticamente de Pendentes;
     - vira `confirmado`;
     - muda o filtro de data para a data marcada pelo cliente;
     - aparece imediatamente na Agenda do dia correspondente.

Também existe uma área de cancelados da data selecionada.
