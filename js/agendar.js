import { setupChrome, TIME_SLOTS, formatPrice, todayISO } from "./barbearia.js";
import {
  listServices,
  listBookedTimes,
  createBooking,
  getCurrentSession,
  getCustomerProfile,
  signOutCustomer,
  formatBrazilPhone,
} from "./supabase.js";

setupChrome();

const serviceSelect = document.querySelector("#servico");
const dateInput = document.querySelector("#data");
const timeGrid = document.querySelector("#timeGrid");
const form = document.querySelector("#bookingForm");
const status = document.querySelector("#bookingStatus");
const submit = document.querySelector("#submitBooking");
const profilePanel = document.querySelector("#clientBookingProfile");
const profileName = document.querySelector("#clientBookingName");
const profilePhone = document.querySelector("#clientBookingPhone");
const logoutButton = document.querySelector("#clientLogoutButton");

let services = [];
let selectedTime = "";
let takenTimes = [];
let customerProfile = null;

await requireCustomerLogin();

if (customerProfile) {
  profileName.textContent = customerProfile.name;
  profilePhone.textContent = `WhatsApp: ${formatBrazilPhone(customerProfile.phone)}`;
  profilePanel.hidden = false;
  form.hidden = false;
}

dateInput.min = todayISO();
dateInput.value = todayISO();

try {
  services = await listServices();
  serviceSelect.innerHTML = services
    .map(service => `<option value="${service.id}">${escapeHtml(service.name)} — ${formatPrice(service.price_cents)} (${service.duration_minutes} min)</option>`)
    .join("");

  const params = new URLSearchParams(location.search);
  if (params.get("servico") && services.some(service => service.id === params.get("servico"))) {
    serviceSelect.value = params.get("servico");
  }
  await refreshTimes();
} catch (error) {
  console.error(error);
  setStatus("Não foi possível carregar os serviços. Confira a configuração do Supabase.", false);
}

dateInput.addEventListener("change", async () => {
  selectedTime = "";
  await refreshTimes();
});

async function refreshTimes() {
  timeGrid.innerHTML = TIME_SLOTS.map(time => `<button type="button" class="time" data-time="${time}">${time}</button>`).join("");

  try {
    takenTimes = await listBookedTimes(dateInput.value);
  } catch (error) {
    console.error(error);
    takenTimes = [];
  }

  timeGrid.querySelectorAll(".time").forEach(button => {
    const time = button.dataset.time;
    if (takenTimes.includes(time)) {
      button.classList.add("taken");
      button.disabled = true;
    }
    button.addEventListener("click", () => {
      selectedTime = time;
      timeGrid.querySelectorAll(".time").forEach(item => item.classList.remove("selected"));
      button.classList.add("selected");
    });
  });
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  status.hidden = true;

  const notes = document.querySelector("#obs").value.trim();
  if (!serviceSelect.value || !selectedTime) {
    return setStatus("Escolha o serviço e o horário.", false);
  }

  submit.disabled = true;
  submit.textContent = "Enviando...";

  try {
    const result = await createBooking({
      serviceId: serviceSelect.value,
      date: dateInput.value,
      time: selectedTime,
      notes,
    });

    setStatus(result.message, result.ok);
    if (result.ok) {
      document.querySelector("#obs").value = "";
      selectedTime = "";
      await refreshTimes();
    }
  } catch (error) {
    console.error(error);
    setStatus("Não foi possível concluir o agendamento. Tente novamente.", false);
  } finally {
    submit.disabled = false;
    submit.textContent = "Confirmar agendamento";
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  logoutButton.textContent = "Saindo...";
  try {
    await signOutCustomer();
  } finally {
    location.replace("cliente-login.html?redirect=agendar.html");
  }
});

async function requireCustomerLogin() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      redirectToLogin();
      return;
    }

    customerProfile = await getCustomerProfile();
    if (!customerProfile) {
      await signOutCustomer().catch(() => {});
      redirectToLogin("cadastro");
    }
  } catch (error) {
    console.error(error);
    redirectToLogin();
  }
}

function redirectToLogin(reason = "") {
  const suffix = reason ? `&reason=${encodeURIComponent(reason)}` : "";
  location.replace(`cliente-login.html?redirect=agendar.html${suffix}`);
}

function setStatus(message, ok) {
  status.hidden = false;
  status.textContent = message;
  status.className = `status ${ok ? "ok" : "error"}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}
