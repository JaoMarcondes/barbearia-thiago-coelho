
import { setupChrome, SHOP, whatsappLink } from "./barbearia.js";
setupChrome();
const a=document.querySelector("#whatsappContact");
const wa=whatsappLink("Olá! Gostaria de falar com a barbearia.");
if(wa){a.href=wa;a.hidden=false;}
