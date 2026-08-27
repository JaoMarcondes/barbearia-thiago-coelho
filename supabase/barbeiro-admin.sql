-- =========================================================
-- ÁREA PRIVADA DO BARBEIRO
-- Execute este arquivo no SQL Editor do Supabase
-- DEPOIS de criar o usuário do barbeiro em Authentication > Users.
-- =========================================================

-- Guarda somente os usuários autorizados a acessar o painel.
CREATE TABLE IF NOT EXISTS public.staff_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;

-- Não criamos policy pública em staff_users.
-- O navegador não precisa ler esta tabela diretamente.

-- Função segura usada pelo site para saber se o usuário autenticado é da equipe.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_users
    WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- Permissões SQL para usuários autenticados.
GRANT SELECT, UPDATE ON public.bookings TO authenticated;

-- Remove políticas antigas com esses nomes caso o script seja executado novamente.
DROP POLICY IF EXISTS "Equipe pode ver agendamentos" ON public.bookings;
DROP POLICY IF EXISTS "Equipe pode atualizar agendamentos" ON public.bookings;

-- SOMENTE usuários presentes em staff_users podem enxergar os dados pessoais
-- dos clientes e alterar o status do agendamento.
CREATE POLICY "Equipe pode ver agendamentos"
ON public.bookings
FOR SELECT
TO authenticated
USING (public.is_staff());

CREATE POLICY "Equipe pode atualizar agendamentos"
ON public.bookings
FOR UPDATE
TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- =========================================================
-- PASSO FINAL
--
-- 1. No Supabase, abra Authentication > Users.
-- 2. Crie o usuário do barbeiro com e-mail e senha.
-- 3. Copie o UUID desse usuário.
-- 4. Rode o comando abaixo substituindo COLE-O-UUID-AQUI:
--
-- INSERT INTO public.staff_users (user_id)
-- VALUES ('COLE-O-UUID-AQUI');
--
-- Pronto. Só esse usuário terá acesso ao painel.
-- =========================================================
