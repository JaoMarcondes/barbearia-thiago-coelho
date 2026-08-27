
import { setupChrome, formatPrice, whatsappLink } from "./barbearia.js";
import { listProducts } from "./supabase.js";
setupChrome();
const root = document.querySelector("#productsList");
try {
  const products = await listProducts();
  root.innerHTML = products.length ? products.map(p => {
    const wa = whatsappLink(`Olá! Tenho interesse no produto: ${p.name}`);
    return `<article class="card" style="padding:0;overflow:hidden">
      <div class="product-image"><img class="${p.image_url ? "" : "no-image"}" src="${p.image_url || "assets/favicon.png"}" alt="${escapeHtml(p.name)}" loading="lazy"></div>
      <div class="product-info"><span class="product-kind">${p.kind === "bone" ? "Boné" : "Camiseta"}</span>
      <h2>${escapeHtml(p.name)}</h2><p class="muted">${escapeHtml(p.description || "")}</p>
      <div class="product-footer"><span class="gold">${formatPrice(p.price_cents)}</span>
      ${wa ? `<a class="btn btn-outline" target="_blank" rel="noreferrer" href="${wa}">Reservar</a>` : ""}</div></div>
    </article>`;
  }).join("") : '<p class="empty">Nenhum produto disponível no momento. Volte em breve.</p>';
} catch(e) { root.innerHTML='<p class="empty">Não foi possível carregar os produtos. Configure o Supabase em js/supabase.js.</p>'; }
function escapeHtml(v){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
