import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeBrazilPhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits.startsWith("55")) digits = `55${digits}`;
  if (digits.length < 12 || digits.length > 13) return "";
  return `+${digits}`;
}

function customerLoginEmail(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@clientes.barbearia.local`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ ok: false, error: "Método não permitido." }, 405);

  try {
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const phone = normalizeBrazilPhone(body?.phone);
    const password = String(body?.password ?? "");
    const whatsappOptIn = Boolean(body?.whatsappOptIn);

    if (name.length < 2 || name.length > 80) {
      return respond({ ok: false, error: "Digite seu nome completo." }, 400);
    }
    if (!phone) {
      return respond({ ok: false, error: "Digite um WhatsApp válido com DDD." }, 400);
    }
    if (password.length < 6 || password.length > 72) {
      return respond({ ok: false, error: "A senha precisa ter entre 6 e 72 caracteres." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return respond({ ok: false, error: "Configuração do servidor indisponível." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const email = customerLoginEmail(phone);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        customer_account: true,
        name,
        customer_phone: phone,
        whatsapp_opt_in: whatsappOptIn,
      },
    });

    if (error) {
      const message = String(error.message || "");
      const lower = message.toLowerCase();
      if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
        return respond({ ok: false, error: "Esse WhatsApp já possui cadastro. Use a opção Entrar." }, 409);
      }
      if (lower.includes("password")) {
        return respond({ ok: false, error: "A senha não atende aos requisitos de segurança." }, 400);
      }
      console.error("register-client createUser:", error);
      return respond({ ok: false, error: "Não foi possível criar a conta agora." }, 400);
    }

    return respond({ ok: true, userId: data.user?.id ?? null, phone }, 201);
  } catch (error) {
    console.error("register-client:", error);
    return respond({ ok: false, error: "Erro inesperado ao criar a conta." }, 500);
  }
});
