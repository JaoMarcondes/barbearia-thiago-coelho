-- =========================================================
-- LOGIN DE CLIENTES COM WHATSAPP + SENHA (E-MAIL INTERNO NO AUTH)
-- Execute este arquivo UMA VEZ no SQL Editor do Supabase.
-- Ele foi feito para funcionar sobre o banco que já existe.
-- =========================================================

-- 1) Cadastro permanente do cliente, separado dos agendamentos.
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  phone text NOT NULL UNIQUE,
  whatsapp_opt_in boolean NOT NULL DEFAULT false,
  whatsapp_opt_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_phone_idx ON public.customers(phone);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ler o próprio perfil.
GRANT SELECT ON public.customers TO authenticated;
GRANT UPDATE (whatsapp_opt_in) ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

DROP POLICY IF EXISTS "Cliente pode ver o próprio cadastro" ON public.customers;
CREATE POLICY "Cliente pode ver o próprio cadastro"
ON public.customers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Cliente pode alterar preferência do WhatsApp" ON public.customers;
CREATE POLICY "Cliente pode alterar preferência do WhatsApp"
ON public.customers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- A equipe pode consultar os clientes para o painel/backend de campanhas.
DROP POLICY IF EXISTS "Equipe pode ver clientes" ON public.customers;
CREATE POLICY "Equipe pode ver clientes"
ON public.customers
FOR SELECT
TO authenticated
USING (public.is_staff());

-- 2) Datas automáticas da preferência de WhatsApp.
CREATE OR REPLACE FUNCTION public.set_customer_whatsapp_opt_in_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();

  IF TG_OP = 'INSERT' THEN
    IF NEW.whatsapp_opt_in = true THEN
      NEW.whatsapp_opt_in_at := COALESCE(NEW.whatsapp_opt_in_at, now());
    ELSE
      NEW.whatsapp_opt_in_at := NULL;
    END IF;
  ELSIF NEW.whatsapp_opt_in = true AND OLD.whatsapp_opt_in = false THEN
    NEW.whatsapp_opt_in_at := now();
  ELSIF NEW.whatsapp_opt_in = false THEN
    NEW.whatsapp_opt_in_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customers_whatsapp_opt_in_timestamp ON public.customers;
CREATE TRIGGER customers_whatsapp_opt_in_timestamp
BEFORE INSERT OR UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.set_customer_whatsapp_opt_in_timestamp();

-- 3) Quando alguém cria uma conta de cliente no Supabase Auth,
-- o telefone vem dos metadados. O Auth usa um e-mail técnico interno.
CREATE OR REPLACE FUNCTION public.handle_new_customer_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer_name text;
  customer_phone text;
  allow_whatsapp boolean;
BEGIN
  -- Usuários administrativos não viram clientes. Somente contas marcadas pelo site.
  IF COALESCE(NEW.raw_user_meta_data ->> 'customer_account', 'false') <> 'true' THEN
    RETURN NEW;
  END IF;

  customer_phone := btrim(COALESCE(NEW.raw_user_meta_data ->> 'customer_phone', ''));
  IF customer_phone = '' THEN
    RETURN NEW;
  END IF;

  customer_name := btrim(COALESCE(NEW.raw_user_meta_data ->> 'name', 'Cliente'));
  IF char_length(customer_name) < 2 THEN
    customer_name := 'Cliente';
  END IF;
  customer_name := left(customer_name, 80);

  allow_whatsapp := COALESCE(NEW.raw_user_meta_data ->> 'whatsapp_opt_in', 'false') = 'true';

  INSERT INTO public.customers (user_id, name, phone, whatsapp_opt_in)
  VALUES (NEW.id, customer_name, customer_phone, allow_whatsapp)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_customer ON auth.users;
CREATE TRIGGER on_auth_user_created_customer
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_customer_user();

-- Se uma conta de cliente já tiver sido criada com o novo formato antes deste SQL,
-- cria o perfil dela agora usando os metadados.
INSERT INTO public.customers (user_id, name, phone, whatsapp_opt_in)
SELECT
  u.id,
  left(btrim(COALESCE(u.raw_user_meta_data ->> 'name', 'Cliente')), 80),
  btrim(u.raw_user_meta_data ->> 'customer_phone'),
  COALESCE(u.raw_user_meta_data ->> 'whatsapp_opt_in', 'false') = 'true'
FROM auth.users u
WHERE COALESCE(u.raw_user_meta_data ->> 'customer_account', 'false') = 'true'
  AND btrim(COALESCE(u.raw_user_meta_data ->> 'customer_phone', '')) <> ''
ON CONFLICT DO NOTHING;

-- 4) Liga cada novo agendamento ao cadastro do cliente.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_customer_id_fkey'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_customer_id_fkey
      FOREIGN KEY (customer_id)
      REFERENCES public.customers(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS bookings_customer_id_idx ON public.bookings(customer_id);

-- A partir de agora o navegador não insere agendamento diretamente.
-- Ele chama a função create_booking, que usa o cliente da sessão autenticada.
REVOKE INSERT ON public.bookings FROM anon;
REVOKE INSERT ON public.bookings FROM authenticated;

DROP POLICY IF EXISTS "Qualquer pessoa pode agendar" ON public.bookings;
DROP POLICY IF EXISTS "Cliente autenticado pode inserir agendamento" ON public.bookings;

-- Cliente pode consultar somente os próprios agendamentos (útil para evolução futura).
DROP POLICY IF EXISTS "Cliente pode ver próprios agendamentos" ON public.bookings;
CREATE POLICY "Cliente pode ver próprios agendamentos"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  customer_id IN (
    SELECT c.id
    FROM public.customers c
    WHERE c.user_id = auth.uid()
  )
  OR public.is_staff()
);

-- 5) Função segura para criar agendamento.
-- Nome e telefone vêm do cadastro associado à sessão; o navegador não escolhe esses dados.
CREATE OR REPLACE FUNCTION public.create_booking(
  p_service_id uuid,
  p_booking_date date,
  p_booking_time time,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer public.customers%ROWTYPE;
  v_booking_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT *
  INTO v_customer
  FROM public.customers
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_profile_missing';
  END IF;

  IF p_booking_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'booking_date_in_past';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.services
    WHERE id = p_service_id
      AND active = true
  ) THEN
    RAISE EXCEPTION 'service_unavailable';
  END IF;

  INSERT INTO public.bookings (
    service_id,
    booking_date,
    booking_time,
    customer_id,
    customer_name,
    customer_phone,
    notes,
    status
  ) VALUES (
    p_service_id,
    p_booking_date,
    p_booking_time,
    v_customer.id,
    v_customer.name,
    v_customer.phone,
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    'pendente'
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking(uuid, date, time, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid, date, time, text) TO authenticated;

-- =========================================================
-- RESULTADO
-- public.customers: 1 cadastro por usuário/WhatsApp
-- public.bookings.customer_id: histórico ligado ao cliente
-- agendamento: somente usuário autenticado
-- campanhas: usam customers.whatsapp_opt_in
-- =========================================================
