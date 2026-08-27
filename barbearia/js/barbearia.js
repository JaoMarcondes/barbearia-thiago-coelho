
const SHOP = {
  name: "Barbearia Thiago Coelho",
  address: "R. Geraldo Preto Rodrigues, 396 - Jardim Paulistano, Sumaré - SP, 13174-571",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("R. Geraldo Preto Rodrigues, 396 - Jardim Paulistano, Sumaré - SP, 13174-571"),
  whatsapp: ""
};

export const TIME_SLOTS = [
  "09:00","09:40","10:20","11:00","11:40",
  "13:00","13:40","14:20","15:00","15:40",
  "16:20","17:00","17:40","18:20","19:00"
];

export function formatPrice(cents) {
  if (cents == null) return "Sob consulta";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function whatsappLink(message) {
  if (!SHOP.whatsapp) return null;
  return `https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function setupChrome() {
  document.querySelector("#year")?.replaceChildren(String(new Date().getFullYear()));
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav]").forEach(a => {
    const href = a.getAttribute("href")?.split("/").pop();
    if (href === current || (current === "" && href === "index.html")) a.classList.add("active");
  });
  const button = document.querySelector("#menuButton");
  const nav = document.querySelector("#mobileNav");
  if (button && nav) {
    button.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      button.setAttribute("aria-expanded", String(open));
    });
  }
}

export { SHOP };
