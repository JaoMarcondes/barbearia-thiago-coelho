import { setupChrome, formatPrice } from "./barbearia.js";
import { listServices } from "./supabase.js";

setupChrome();

const fallbackServices = [
  { id: "1", name: "Corte de cabelo", description: "Corte clássico ou moderno, finalizado com máquina e tesoura.", price_cents: null, duration_minutes: 40 },
  { id: "2", name: "Corte com tesoura", description: "Corte totalmente executado na tesoura, para um acabamento natural.", price_cents: null, duration_minutes: 50 },
  { id: "3", name: "Cortes infantis", description: "Corte com paciência e cuidado para os pequenos.", price_cents: null, duration_minutes: 30 },
  { id: "4", name: "Barba", description: "Barba feita com toalha quente e produtos de qualidade.", price_cents: null, duration_minutes: 30 },
  { id: "5", name: "Barba com navalha", description: "Acabamento clássico na navalha, rente e preciso.", price_cents: null, duration_minutes: 40 },
  { id: "6", name: "Aparar a barba", description: "Manutenção rápida do desenho e do comprimento da barba.", price_cents: null, duration_minutes: 20 },
  { id: "7", name: "Alisamento de cabelo", description: "Alisamento profissional com produtos específicos.", price_cents: null, duration_minutes: 90 },
  { id: "8", name: "Coloração de cabelo", description: "Coloração e cobertura de brancos.", price_cents: null, duration_minutes: 60 }
];

const root = document.querySelector("#servicesList");

function renderServices(services) {
  root.innerHTML = services.map(service => `
    <article class="service-row">
      <div class="service-info">
        <h2>${escapeHtml(service.name)}</h2>
        <p>${escapeHtml(service.description || "")}</p>
      </div>

      <div class="service-meta">
        <div class="service-price-wrap">
          <div class="price">${service.price_cents == null ? "Sob consulta" : formatPrice(service.price_cents)}</div>
          <div class="duration">${service.duration_minutes} min</div>
        </div>

        <a class="btn btn-outline service-book" href="agendar.html?servico=${encodeURIComponent(service.id || service.name)}">
          Agendar
        </a>
      </div>
    </article>
  `).join("");
}

if (root) {
  try {
    const services = await listServices();
    renderServices(services.length ? services : fallbackServices);
  } catch (error) {
    console.warn("Supabase indisponível; exibindo lista local de serviços.", error);
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
