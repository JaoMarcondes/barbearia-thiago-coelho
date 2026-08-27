import { supabase } from "./supabase.js";

const form = document.querySelector("#staffLoginForm");
const status = document.querySelector("#staffLoginStatus");
const button = document.querySelector("#staffLoginButton");

const { data: { session } } = await supabase.auth.getSession();
if (session) {
  const allowed = await checkStaff();
  if (allowed) location.replace("barbeiro.html");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("", true, true);

  const email = document.querySelector("#staffEmail").value.trim();
  const password = document.querySelector("#staffPassword").value;

  button.disabled = true;
  button.textContent = "Entrando...";

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    setStatus("E-mail ou senha incorretos.", false);
    button.disabled = false;
    button.textContent = "Entrar";
    return;
  }

  const allowed = await checkStaff();

  if (!allowed) {
    await supabase.auth.signOut();
    setStatus("Esta conta não tem acesso à área do barbeiro.", false);
    button.disabled = false;
    button.textContent = "Entrar";
    return;
  }

  location.replace("barbeiro.html");
});

async function checkStaff() {
  const { data, error } = await supabase.rpc("is_staff");
  return !error && data === true;
}

function setStatus(message, ok, hidden = false) {
  status.hidden = hidden;
  status.textContent = message;
  status.className = `status ${ok ? "ok" : "error"}`;
}
