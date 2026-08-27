import { supabase } from "./supabase.js";

const pendingList = document.querySelector("#pendingBookingsList");
const confirmedList = document.querySelector("#confirmedBookingsList");
const cancelledList = document.querySelector("#cancelledBookingsList");
const dashboardStatus = document.querySelector("#staffDashboardStatus");
const dateFilter = document.querySelector("#bookingDateFilter");
const logoutButton = document.querySelector("#staffLogout");
const emailLabel = document.querySelector("#staffUserEmail");

let allBookings = [];

const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  location.replace("barbeiro-login.html");
} else {
  const { data: allowed, error: staffError } = await supabase.rpc("is_staff");

  if (staffError || allowed !== true) {
    await supabase.auth.signOut();
    location.replace("barbeiro-login.html");
  } else {
    emailLabel.textContent = session.user.email || "";
    dateFilter.value = todayISO();
    await loadBookings();
  }
}

dateFilter.addEventListener("change", renderAll);

logoutButton.addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.replace("barbeiro-login.html");
});

async function loadBookings() {
  setLoading();

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      booking_date,
      booking_time,
      customer_name,
      customer_phone,
      notes,
      status,
      created_at,
      services ( name )
    `)
    .order("booking_date", { ascending: true })
    .order("booking_time", { ascending: true });

  if (error) {
    showStatus(
      "Não foi possível carregar os agendamentos. Verifique as regras da área do barbeiro no Supabase.",
      false
    );
    pendingList.innerHTML = "";
    confirmedList.innerHTML = "";
    cancelledList.innerHTML = "";
    return;
  }

  allBookings = data || [];
  renderAll();
}

function renderAll() {
  renderPending();
  renderConfirmed();
  renderCancelled();
  updateSummary();
}

function renderPending() {
  const pending = allBookings
    .filter(booking => booking.status === "pendente")
    .sort(compareBookings);

  if (!pending.length) {
    pendingList.innerHTML = `
      <div class="staff-empty">
        <strong>Nenhum pendente</strong>
        <span>Todos os pedidos já foram respondidos.</span>
      </div>`;
    return;
  }

  pendingList.innerHTML = pending.map(booking => bookingCard(booking, "pending")).join("");
  bindActions(pendingList);
}

function renderConfirmed() {
  const selectedDate = dateFilter.value;

  const confirmed = allBookings
    .filter(booking =>
      booking.status === "confirmado" &&
      booking.booking_date === selectedDate
    )
    .sort(compareBookings);

  if (!confirmed.length) {
    confirmedList.innerHTML = `
      <div class="staff-empty">
        <strong>Nenhum confirmado</strong>
        <span>Não há agendamentos confirmados para ${formatDate(selectedDate)}.</span>
      </div>`;
    return;
  }

  confirmedList.innerHTML = confirmed.map(booking => bookingCard(booking, "confirmed")).join("");
  bindActions(confirmedList);
}

function renderCancelled() {
  const selectedDate = dateFilter.value;

  const cancelled = allBookings
    .filter(booking =>
      booking.status === "cancelado" &&
      booking.booking_date === selectedDate
    )
    .sort(compareBookings);

  if (!cancelled.length) {
    cancelledList.innerHTML = `
      <div class="staff-empty compact">
        <strong>Nenhum cancelado</strong>
        <span>Sem cancelamentos para ${formatDate(selectedDate)}.</span>
      </div>`;
    return;
  }

  cancelledList.innerHTML = cancelled.map(booking => bookingCard(booking, "cancelled")).join("");
  bindActions(cancelledList);
}

function bookingCard(booking, area) {
  const serviceName = booking.services?.name || "Serviço";

  let actions = "";

  if (area === "pending") {
    actions = `
      <button class="btn btn-gold staff-action" data-status="confirmado" type="button">
        Confirmar
      </button>
      <button class="btn btn-outline staff-action" data-status="cancelado" type="button">
        Cancelar
      </button>`;
  } else if (area === "confirmed") {
    actions = `
      <button class="btn btn-outline staff-action" data-status="cancelado" type="button">
        Cancelar
      </button>
      <button class="staff-link-action staff-action" data-status="pendente" type="button">
        Voltar para pendente
      </button>`;
  } else {
    actions = `
      <button class="staff-link-action staff-action" data-status="pendente" type="button">
        Voltar para pendente
      </button>`;
  }

  return `
    <article class="staff-booking-card" data-booking-id="${booking.id}">
      <div class="staff-booking-time">
        <strong>${formatTime(booking.booking_time)}</strong>
        <span>${formatDate(booking.booking_date)}</span>
      </div>

      <div class="staff-booking-main">
        <div class="staff-booking-name-row">
          <h2>${escapeHtml(booking.customer_name)}</h2>
          <span class="staff-status staff-status-${booking.status}">
            ${statusLabel(booking.status)}
          </span>
        </div>

        <p class="staff-booking-service">${escapeHtml(serviceName)}</p>
        <p class="staff-booking-phone">${escapeHtml(booking.customer_phone)}</p>
        ${booking.notes
          ? `<p class="staff-booking-notes">Obs.: ${escapeHtml(booking.notes)}</p>`
          : ""}
      </div>

      <div class="staff-booking-actions">
        ${actions}
      </div>
    </article>`;
}

function bindActions(container) {
  container.querySelectorAll(".staff-action").forEach(button => {
    button.addEventListener("click", async () => {
      const card = button.closest("[data-booking-id]");
      await updateBookingStatus(card.dataset.bookingId, button.dataset.status);
    });
  });
}

async function updateBookingStatus(id, newStatus) {
  const booking = allBookings.find(item => item.id === id);

  if (!booking) {
    showStatus("Agendamento não encontrado.", false);
    return;
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: newStatus })
    .eq("id", id);

  if (error) {
    showStatus("Não foi possível atualizar esse agendamento.", false);
    return;
  }

  booking.status = newStatus;

  // Ao confirmar, abre automaticamente a data marcada pelo cliente.
  // Assim o agendamento sai de Pendentes e aparece na Agenda do dia correto.
  if (newStatus === "confirmado") {
    dateFilter.value = booking.booking_date;
    showStatus(
      `Agendamento confirmado. Abrindo a agenda de ${formatDate(booking.booking_date)}.`,
      true
    );
  } else if (newStatus === "cancelado") {
    dateFilter.value = booking.booking_date;
    showStatus("Agendamento cancelado.", true);
  } else {
    showStatus("Agendamento voltou para pendente.", true);
  }

  renderAll();
}

function updateSummary() {
  const today = todayISO();

  document.querySelector("#countPending").textContent =
    allBookings.filter(b => b.status === "pendente").length;

  document.querySelector("#countConfirmed").textContent =
    allBookings.filter(b => b.status === "confirmado").length;

  document.querySelector("#countToday").textContent =
    allBookings.filter(
      b => b.status === "confirmado" && b.booking_date === today
    ).length;
}

function setLoading() {
  pendingList.innerHTML = '<p class="loading">Carregando pendentes...</p>';
  confirmedList.innerHTML = '<p class="loading">Carregando agenda...</p>';
  cancelledList.innerHTML = '<p class="loading">Carregando cancelados...</p>';
}

function compareBookings(a, b) {
  const dateCompare = String(a.booking_date).localeCompare(String(b.booking_date));
  if (dateCompare !== 0) return dateCompare;
  return String(a.booking_time).localeCompare(String(b.booking_time));
}

function showStatus(message, ok) {
  dashboardStatus.hidden = false;
  dashboardStatus.textContent = message;
  dashboardStatus.className = `status ${ok ? "ok" : "error"}`;

  clearTimeout(showStatus.timer);
  showStatus.timer = setTimeout(() => {
    dashboardStatus.hidden = true;
  }, 4000);
}

function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  return `${day}/${month}/${year}`;
}

function formatTime(value) {
  return String(value || "").slice(0, 5);
}

function statusLabel(value) {
  return {
    pendente: "Pendente",
    confirmado: "Confirmado",
    cancelado: "Cancelado"
  }[value] || value;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}
