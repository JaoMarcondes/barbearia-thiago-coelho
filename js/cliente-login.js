import { setupChrome } from "./barbearia.js";
import {
  getCurrentSession,
  getCustomerProfile,
  signInCustomer,
  signUpCustomer,
  normalizeBrazilPhone,
} from "./supabase.js";

setupChrome();

const loginTab = document.querySelector("#clientLoginTab");
const registerTab = document.querySelector("#clientRegisterTab");
const loginForm = document.querySelector("#clientLoginForm");
const registerForm = document.querySelector("#clientRegisterForm");
const loginStatus = document.querySelector("#clientLoginStatus");
const registerStatus = document.querySelector("#clientRegisterStatus");
const loginButton = document.querySelector("#clientLoginButton");
const registerButton = document.querySelector("#clientRegisterButton");

const redirectTarget = getSafeRedirect();

try {
  const session = await getCurrentSession();
  if (session) {
    const profile = await getCustomerProfile().catch(() => null);
    if (profile) location.replace(redirectTarget);
  }
} catch (error) {
  console.error(error);
}

loginTab.addEventListener("click", () => showMode("login"));
registerTab.addEventListener("click", () => showMode("register"));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(loginStatus, "", true, true);

  const phone = document.querySelector("#clientLoginPhone").value;
  const password = document.querySelector("#clientLoginPassword").value;

  setBusy(loginButton, true, "Entrando...");
  try {
    const result = await signInCustomer({ phone, password });
    if (!result.ok) return setStatus(loginStatus, result.message, false);

    const profile = await waitForProfile();
    if (!profile) {
      return setStatus(loginStatus, "Sua conta entrou, mas o cadastro de cliente não foi encontrado. Execute o arquivo supabase/clientes-auth.sql.", false);
    }

    location.replace(redirectTarget);
  } catch (error) {
    console.error(error);
    setStatus(loginStatus, "Não foi possível entrar agora. Tente novamente.", false);
  } finally {
    setBusy(loginButton, false, "Entrar e agendar");
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(registerStatus, "", true, true);

  const name = document.querySelector("#clientRegisterName").value.trim();
  const phone = document.querySelector("#clientRegisterPhone").value;
  const password = document.querySelector("#clientRegisterPassword").value;
  const passwordConfirm = document.querySelector("#clientRegisterPasswordConfirm").value;
  const whatsappOptIn = document.querySelector("#clientWhatsappOptIn").checked;

  if (password !== passwordConfirm) {
    return setStatus(registerStatus, "As duas senhas precisam ser iguais.", false);
  }

  setBusy(registerButton, true, "Criando conta...");
  try {
    const result = await signUpCustomer({ name, phone, password, whatsappOptIn });
    if (!result.ok) return setStatus(registerStatus, result.message, false);

    const profile = await waitForProfile();
    if (!profile) {
      return setStatus(registerStatus, "A conta foi criada, mas o perfil ainda não apareceu. Execute supabase/clientes-auth.sql e tente entrar novamente.", false);
    }

    location.replace(redirectTarget);
  } catch (error) {
    console.error(error);
    setStatus(registerStatus, "Não foi possível criar a conta agora. Tente novamente.", false);
  } finally {
    setBusy(registerButton, false, "Criar conta");
  }
});

function showMode(mode) {
  const login = mode === "login";
  loginForm.hidden = !login;
  registerForm.hidden = login;
  loginTab.classList.toggle("active", login);
  registerTab.classList.toggle("active", !login);
  loginTab.setAttribute("aria-selected", String(login));
  registerTab.setAttribute("aria-selected", String(!login));
}

async function waitForProfile() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const profile = await getCustomerProfile().catch(() => null);
    if (profile) return profile;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return null;
}

function getSafeRedirect() {
  const requested = new URLSearchParams(location.search).get("redirect") || "agendar.html";
  if (!/^[a-zA-Z0-9_.-]+\.html(?:\?.*)?$/.test(requested)) return "agendar.html";
  return requested;
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  button.textContent = label;
}

function setStatus(element, message, ok, hide = false) {
  element.hidden = hide;
  if (hide) return;
  element.textContent = message;
  element.className = `status ${ok ? "ok" : "error"}`;
}

// Formatação visual simples do telefone sem alterar o valor usado pelo Supabase.
document.querySelectorAll('input[type="tel"]').forEach(input => {
  input.addEventListener("blur", () => {
    const normalized = normalizeBrazilPhone(input.value);
    if (normalized) input.value = formatBrazilPhone(normalized);
  });
});
