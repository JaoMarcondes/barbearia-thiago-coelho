import os
import re
from typing import Dict, List, Tuple

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)

origins = [
    item.strip()
    for item in os.getenv(
        "FRONTEND_ORIGINS",
        "http://127.0.0.1:5500,http://localhost:5500",
    ).split(",")
    if item.strip()
]

CORS(
    app,
    resources={r"/api/*": {"origins": origins}},
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "OPTIONS"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WHATSAPP_TEMPLATE_NAME = os.getenv("WHATSAPP_TEMPLATE_NAME", "promocao_barbearia")
WHATSAPP_TEMPLATE_LANGUAGE = os.getenv("WHATSAPP_TEMPLATE_LANGUAGE", "pt_BR")
META_GRAPH_API_VERSION = os.getenv("META_GRAPH_API_VERSION", "v26.0")
MAX_RECIPIENTS = max(1, int(os.getenv("WHATSAPP_MAX_RECIPIENTS_PER_SEND", "100")))


def json_error(message: str, status: int):
    return jsonify({"ok": False, "error": message}), status


def require_config() -> Tuple[bool, str]:
    missing = []
    for name, value in (
        ("SUPABASE_URL", SUPABASE_URL),
        ("SUPABASE_ANON_KEY", SUPABASE_ANON_KEY),
        ("WHATSAPP_ACCESS_TOKEN", WHATSAPP_ACCESS_TOKEN),
        ("WHATSAPP_PHONE_NUMBER_ID", WHATSAPP_PHONE_NUMBER_ID),
        ("WHATSAPP_TEMPLATE_NAME", WHATSAPP_TEMPLATE_NAME),
    ):
        if not value:
            missing.append(name)

    if missing:
        return False, "Variáveis ausentes no backend: " + ", ".join(missing)
    return True, ""


def bearer_token() -> str:
    header = request.headers.get("Authorization", "").strip()
    if not header.lower().startswith("bearer "):
        return ""
    return header.split(" ", 1)[1].strip()


def supabase_headers(token: str) -> Dict[str, str]:
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def verify_staff(token: str) -> Tuple[bool, str]:
    try:
        user_response = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers=supabase_headers(token),
            timeout=12,
        )
        if user_response.status_code != 200:
            return False, "Sessão inválida ou expirada."

        staff_response = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/is_staff",
            headers=supabase_headers(token),
            json={},
            timeout=12,
        )
        if staff_response.status_code != 200:
            return False, "Não foi possível verificar a permissão da conta."

        return staff_response.json() is True, "Conta sem permissão de barbeiro."
    except requests.RequestException:
        return False, "Não foi possível validar a sessão no Supabase."


def normalize_brazil_phone(value: str) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    if digits.startswith("00"):
        digits = digits[2:]
    if not digits.startswith("55"):
        digits = "55" + digits
    if len(digits) not in (12, 13):
        return ""
    return digits


def load_opted_in_customers(token: str) -> List[Dict[str, str]]:
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/customers",
        headers=supabase_headers(token),
        params={
            "select": "name,phone,created_at",
            "whatsapp_opt_in": "eq.true",
            "order": "created_at.desc",
            "limit": str(MAX_RECIPIENTS),
        },
        timeout=15,
    )
    response.raise_for_status()

    recipients: List[Dict[str, str]] = []
    for row in response.json() or []:
        phone = normalize_brazil_phone(row.get("phone", ""))
        if not phone:
            continue
        recipients.append(
            {
                "name": str(row.get("name") or "Cliente").strip()[:80],
                "phone": phone,
            }
        )

    return recipients[:MAX_RECIPIENTS]


def send_marketing_template(phone: str, title: str, description: str) -> Tuple[bool, Dict]:
    url = (
        f"https://graph.facebook.com/{META_GRAPH_API_VERSION}/"
        f"{WHATSAPP_PHONE_NUMBER_ID}/messages"
    )

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "template",
        "template": {
            "name": WHATSAPP_TEMPLATE_NAME,
            "language": {"code": WHATSAPP_TEMPLATE_LANGUAGE},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": title},
                        {"type": "text", "text": description},
                    ],
                }
            ],
        },
    }

    response = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=20,
    )

    try:
        data = response.json()
    except ValueError:
        data = {"raw": response.text[:300]}

    return response.ok, data


@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "barbearia-whatsapp-python"})


@app.post("/api/whatsapp/promocao")
def send_promotion():
    configured, config_error = require_config()
    if not configured:
        return json_error(config_error, 500)

    token = bearer_token()
    if not token:
        return json_error("Usuário não autenticado.", 401)

    allowed, auth_error = verify_staff(token)
    if not allowed:
        return json_error(auth_error, 403)

    body = request.get_json(silent=True) or {}
    title = str(body.get("title") or "").strip()
    description = str(body.get("description") or "").strip()

    if not 1 <= len(title) <= 60:
        return json_error("O nome da mensagem deve ter entre 1 e 60 caracteres.", 400)
    if not 1 <= len(description) <= 500:
        return json_error("A descrição deve ter entre 1 e 500 caracteres.", 400)

    try:
        recipients = load_opted_in_customers(token)
    except requests.RequestException:
        return json_error(
            "Não foi possível buscar os clientes autorizados no Supabase. Execute supabase/clientes-auth.sql.",
            500,
        )

    if not recipients:
        return json_error(
            "Nenhum cliente autorizou promoções pelo WhatsApp ainda.",
            400,
        )

    sent = 0
    failures = []

    for customer in recipients:
        ok, result = send_marketing_template(
            customer["phone"],
            title,
            description,
        )
        if ok:
            sent += 1
        else:
            error = result.get("error") if isinstance(result, dict) else None
            failures.append(
                {
                    "phone_last4": customer["phone"][-4:],
                    "message": (
                        str(error.get("message"))[:180]
                        if isinstance(error, dict)
                        else "Meta recusou a mensagem."
                    ),
                }
            )

    return jsonify(
        {
            "ok": sent > 0,
            "total": len(recipients),
            "sent": sent,
            "failed": len(failures),
            "failures": failures[:10],
        }
    ), (200 if sent > 0 else 502)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="127.0.0.1", port=port, debug=True)
