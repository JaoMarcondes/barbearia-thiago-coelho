
import { setupChrome, TIME_SLOTS, formatPrice, todayISO } from "./barbearia.js";
import { listServices, listBookedTimes, createBooking } from "./supabase.js";
setupChrome();

const serviceSelect = document.querySelector("#servico");
const dateInput = document.querySelector("#data");
const timeGrid = document.querySelector("#timeGrid");
const form = document.querySelector("#bookingForm");
const status = document.querySelector("#bookingStatus");
const submit = document.querySelector("#submitBooking");
let services = [];
let selectedTime = "";
let takenTimes = [];

dateInput.min = todayISO();
dateInput.value = todayISO();

try {
  services = await listServices();
  serviceSelect.innerHTML = services.map(s => `<option value="${s.id}">${escapeHtml(s.name)} — ${formatPrice(s.price_cents)} (${s.duration_minutes} min)</option>`).join("");
  const params = new URLSearchParams(location.search);
  if (params.get("servico") && services.some(s => s.id === params.get("servico"))) serviceSelect.value = params.get("servico");
  await refreshTimes();
} catch(e) {
  setStatus("Não foi possível carregar os serviços. Configure o Supabase em js/supabase.js.", false);
}

dateInput.addEventListener("change", async () => { selectedTime=""; await refreshTimes(); });
async function refreshTimes() {
  timeGrid.innerHTML = TIME_SLOTS.map(t => `<button type="button" class="time" data-time="${t}">${t}</button>`).join("");
  try { takenTimes = await listBookedTimes(dateInput.value); } catch(e) { takenTimes=[]; }
  timeGrid.querySelectorAll(".time").forEach(btn => {
    const t=btn.dataset.time;
    if(takenTimes.includes(t)) btn.classList.add("taken"), btn.disabled=true;
    btn.addEventListener("click",()=>{selectedTime=t; timeGrid.querySelectorAll(".time").forEach(x=>x.classList.remove("selected")); btn.classList.add("selected");});
  });
}
form.addEventListener("submit", async e => {
  e.preventDefault(); status.hidden=true;
  const name=document.querySelector("#nome").value.trim();
  const phone=document.querySelector("#telefone").value.trim();
  const notes=document.querySelector("#obs").value.trim();
  if(!serviceSelect.value || !selectedTime || name.length<2 || phone.length<8) return setStatus("Preencha serviço, horário, nome e telefone.", false);
  submit.disabled=true; submit.textContent="Enviando...";
  try {
    const result=await createBooking({serviceId:serviceSelect.value,date:dateInput.value,time:selectedTime,name,phone,notes});
    setStatus(result.message,result.ok);
    if(result.ok){ document.querySelector("#nome").value=""; document.querySelector("#telefone").value=""; document.querySelector("#obs").value=""; selectedTime=""; await refreshTimes(); }
  } catch(e){ setStatus("Não foi possível concluir o agendamento. Tente novamente.",false); }
  finally { submit.disabled=false; submit.textContent="Confirmar agendamento"; }
});
function setStatus(message,ok){status.hidden=false;status.textContent=message;status.className=`status ${ok?"ok":"error"}`;}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
