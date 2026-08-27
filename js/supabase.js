
// Coloque aqui as credenciais PUBLICÁVEIS do seu projeto Supabase.
// Não use a service_role key no navegador.
export const SUPABASE_URL = "https://bhcmderbhmzqwlmfayhb.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_q6ark8R5NNvfKflpKqyXow_RybRWb3m";

export const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

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
  return (data || []).map(row => String(row.booking_time).slice(0,5));
}

export async function createBooking({ serviceId, date, time, name, phone, notes }) {
  const { error } = await supabase.from("bookings").insert({
    service_id: serviceId,
    booking_date: date,
    booking_time: `${time}:00`,
    customer_name: name.trim(),
    customer_phone: phone.trim(),
    notes: notes?.trim() || null,
    status: "pendente"
  });
  if (error) {
    if (error.code === "23505") return { ok:false, message:"Esse horário acabou de ser reservado. Escolha outro." };
    return { ok:false, message:"Não foi possível concluir o agendamento. Tente novamente." };
  }
  return { ok:true, message:"Agendamento enviado com sucesso!" };
}
