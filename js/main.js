import { setupChrome, formatPrice } from "./barbearia.js";
import { listServices } from "./supabase.js";

setupChrome();

const fallbackServices = [
  {name:"Corte de cabelo", description:"Corte clássico ou moderno, finalizado com máquina e tesoura.", price_cents:null, duration_minutes:40},
  {name:"Corte com tesoura", description:"Corte totalmente executado na tesoura, para um acabamento natural.", price_cents:null, duration_minutes:50},
  {name:"Cortes infantis", description:"Corte com paciência e cuidado para os pequenos.", price_cents:null, duration_minutes:30},
  {name:"Barba", description:"Barba feita com toalha quente e produtos de qualidade.", price_cents:null, duration_minutes:30},
  {name:"Barba com navalha", description:"Acabamento clássico na navalha, rente e preciso.", price_cents:null, duration_minutes:40},
  {name:"Aparar a barba", description:"Manutenção rápida do desenho e do comprimento da barba.", price_cents:null, duration_minutes:20}
];

const target = document.querySelector("#homeServices");

function renderServices(services) {
  target.innerHTML = services.slice(0, 6).map(service => `
    <article class="card">
      <h3>${escapeHtml(service.name)}</h3>
      <p class="muted">${escapeHtml(service.description || "")}</p>
      <div class="card-bottom">
        <span class="gold">${service.price_cents == null ? "Sob consulta" : formatPrice(service.price_cents)}</span>
        <span class="muted">${service.duration_minutes} min</span>
      </div>
    </article>
  `).join("");
}

if (target) {
  try {
    const services = await listServices();
    renderServices(services.length ? services : fallbackServices);
  } catch (error) {
    console.warn("Supabase indisponível; exibindo os serviços padrão.", error);
    renderServices(fallbackServices);
  }
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
