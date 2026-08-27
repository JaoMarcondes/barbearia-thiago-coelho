CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_cents integer,
  duration_minutes integer NOT NULL DEFAULT 30,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('camiseta','bone')),
  description text,
  price_cents integer,
  image_url text,
  available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  booking_date date NOT NULL,
  booking_time time NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','confirmado','cancelado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_date, booking_time)
);

GRANT SELECT ON public.services TO anon, authenticated;
GRANT ALL ON public.services TO service_role;
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
GRANT INSERT ON public.bookings TO anon, authenticated;
GRANT ALL ON public.bookings TO service_role;

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Serviços ativos são públicos" ON public.services
  FOR SELECT TO anon, authenticated USING (active = true);

CREATE POLICY "Produtos disponíveis são públicos" ON public.products
  FOR SELECT TO anon, authenticated USING (available = true);

CREATE POLICY "Qualquer pessoa pode agendar" ON public.bookings
  FOR INSERT TO anon, authenticated WITH CHECK (
    booking_date >= CURRENT_DATE
    AND status = 'pendente'
    AND length(customer_name) BETWEEN 2 AND 80
    AND length(customer_phone) BETWEEN 8 AND 20
  );

CREATE OR REPLACE FUNCTION public.get_booked_times(p_date date)
RETURNS TABLE (booking_time time)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.booking_time FROM public.bookings b
  WHERE b.booking_date = p_date AND b.status <> 'cancelado';
$$;

GRANT EXECUTE ON FUNCTION public.get_booked_times(date) TO anon, authenticated;

INSERT INTO public.services (name, description, duration_minutes, sort_order) VALUES
  ('Corte de cabelo', 'Corte clássico ou moderno, finalizado com máquina e tesoura.', 40, 1),
  ('Corte com tesoura', 'Corte totalmente executado na tesoura, para um acabamento natural.', 50, 2),
  ('Cortes infantis', 'Corte com paciência e cuidado para os pequenos.', 30, 3),
  ('Barba', 'Barba feita com toalha quente e produtos de qualidade.', 30, 4),
  ('Barba com navalha', 'Acabamento clássico na navalha, rente e preciso.', 40, 5),
  ('Aparar a barba', 'Manutenção rápida do desenho e do comprimento da barba.', 20, 6),
  ('Alisamento de cabelo', 'Alisamento profissional com produtos específicos.', 90, 7),
  ('Coloração de cabelo', 'Coloração e cobertura de brancos.', 60, 8);

INSERT INTO public.products (name, kind, description, sort_order) VALUES
  ('Camiseta Thiago Coelho', 'camiseta', 'Camiseta de algodão com a logo da barbearia. Tamanhos P ao GG.', 1),
  ('Boné Thiago Coelho', 'bone', 'Boné com bordado da barbearia, tamanho ajustável.', 2);