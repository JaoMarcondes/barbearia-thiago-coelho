// Credenciais PUBLICÁVEIS do projeto Supabase.
// Nunca coloque service_role, senha do banco ou tokens privados no navegador.
export const SUPABASE_URL = "https://bhcmderbhmzqwlmfayhb.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_q6ark8R5NNvfKflpKqyXow_RybRWb3m";

export const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

export function normalizeBrazilPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits.startsWith("55")) digits = `55${digits}`;
  if (digits.length < 12 || digits.length > 13) return "";
  return `+${digits}`;
}

export function formatBrazilPhone(value) {
  const normalized = normalizeBrazilPhone(value);
  if (!normalized) return String(value || "");

  const local = normalized.slice(3);
  const ddd = local.slice(0, 2);
  const number = local.slice(2);
  if (number.length === 9) {
    return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
  }
  return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export async function getCustomerProfile() {
  const session = await getCurrentSession();
  if (!session?.user) return null;

  const { data, error } = await supabase
    .from("customers")
    .select("id, user_id, name, phone, whatsapp_opt_in, whatsapp_opt_in_at, created_at")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export function customerLoginEmail(phone) {
  const normalizedPhone = normalizeBrazilPhone(phone);
  if (!normalizedPhone) return "";
  // E-mail técnico usado apenas como identificador interno no Supabase Auth.
  // O cliente nunca precisa ver ou digitar este endereço.
  const digits = normalizedPhone.replace(/\D/g, "");
  return `${digits}@clientes.barbearia.local`;
}

export async function signInCustomer({ phone, password }) {
  const normalizedPhone = normalizeBrazilPhone(phone);
  const internalEmail = customerLoginEmail(phone);
  if (!normalizedPhone || !internalEmail) {
    return { ok: false, message: "Digite um WhatsApp válido com DDD." };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: internalEmail,
    password,
  });

  if (error) {
    return { ok: false, message: translateAuthError(error.message) };
  }

  return { ok: true, session: data.session, user: data.user };
}

export async function signUpCustomer({ name, phone, password, whatsappOptIn }) {
  const cleanName = String(name || "").trim();
  const normalizedPhone = normalizeBrazilPhone(phone);
  const internalEmail = customerLoginEmail(phone);

  if (cleanName.length < 2 || cleanName.length > 80) {
    return { ok: false, message: "Digite seu nome completo." };
  }
  if (!normalizedPhone || !internalEmail) {
    return { ok: false, message: "Digite um WhatsApp válido com DDD." };
  }
  if (String(password || "").length < 6) {
    return { ok: false, message: "A senha precisa ter pelo menos 6 caracteres." };
  }

  // O cadastro é criado por uma Edge Function com privilégios de servidor.
  // Assim a conta já nasce confirmada e não é necessário enviar e-mail ou SMS.
  const { data: registerData, error: registerError } = await supabase.functions.invoke("register-client", {
    body: {
      name: cleanName,
      phone: normalizedPhone,
      password,
      whatsappOptIn: Boolean(whatsappOptIn),
    },
  });

  if (registerError) {
    const context = registerError.context;
    if (context && typeof context.json === "function") {
      try {
        const payload = await context.json();
        if (payload?.error) return { ok: false, message: payload.error };
      } catch (_) {}
    }
    return { ok: false, message: translateAuthError(registerError.message) };
  }

  if (!registerData?.ok) {
    return { ok: false, message: registerData?.error || "Não foi possível criar a conta." };
  }

  // Depois da criação confirmada, entra normalmente com o identificador interno.
  const { data, error } = await supabase.auth.signInWithPassword({
    email: internalEmail,
    password,
  });

  if (error) {
    return { ok: false, message: translateAuthError(error.message) };
  }

  return {
    ok: true,
    session: data.session,
    user: data.user,
    phone: normalizedPhone,
    needsVerification: false,
  };
}

export async function signOutCustomer() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function updateCustomerWhatsAppOptIn(enabled) {
  const session = await getCurrentSession();
  if (!session?.user) throw new Error("Usuário não autenticado.");

  const { data, error } = await supabase
    .from("customers")
    .update({ whatsapp_opt_in: Boolean(enabled) })
    .eq("user_id", session.user.id)
    .select("id, user_id, name, phone, whatsapp_opt_in, whatsapp_opt_in_at")
    .single();

  if (error) throw error;
  return data;
}

export async function listServices() {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, description, price_cents, duration_minutes")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, kind, description, price_cents, image_url")
    .eq("available", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listBookedTimes(date) {
  const { data, error } = await supabase.rpc("get_booked_times", { p_date: date });
  if (error) throw error;
  return (data || []).map(row => String(row.booking_time).slice(0, 5));
}

export async function createBooking({ serviceId, date, time, notes }) {
  const { data, error } = await supabase.rpc("create_booking", {
    p_service_id: serviceId,
    p_booking_date: date,
    p_booking_time: `${time}:00`,
    p_notes: notes?.trim() || null,
  });

  if (error) {
    const combined = `${error.code || ""} ${error.message || ""} ${error.details || ""}`.toLowerCase();
    if (error.code === "23505" || combined.includes("duplicate") || combined.includes("unique")) {
      return { ok: false, message: "Esse horário acabou de ser reservado. Escolha outro." };
    }
    if (combined.includes("customer_profile_missing")) {
      return { ok: false, message: "Seu cadastro de cliente não foi encontrado. Saia e entre novamente." };
    }
    if (combined.includes("not_authenticated") || error.code === "28000") {
      return { ok: false, message: "Sua sessão expirou. Entre novamente para agendar." };
    }
    return { ok: false, message: "Não foi possível concluir o agendamento. Tente novamente." };
  }

  return { ok: true, bookingId: data, message: "Agendamento enviado com sucesso!" };
}

function translateAuthError(message) {
  const text = String(message || "").toLowerCase();
  if (text.includes("invalid login credentials")) return "WhatsApp ou senha incorretos.";
  if (text.includes("user already registered") || text.includes("already been registered")) return "Esse WhatsApp já possui cadastro. Use a opção Entrar.";
  if (text.includes("password") && text.includes("least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (text.includes("rate limit")) return "Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.";
  return message || "Não foi possível autenticar.";
}
