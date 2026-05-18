-- Tabla de usuarios de prueba (beta). Se reemplazará por auth real al lanzar el dominio.
CREATE TABLE public.test_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  surname TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_test_users_email ON public.test_users (lower(email));

ALTER TABLE public.test_users ENABLE ROW LEVEL SECURITY;

-- Acceso público (beta sin auth real): leer e insertar libremente.
CREATE POLICY "Public read test_users"
  ON public.test_users
  FOR SELECT
  USING (true);

CREATE POLICY "Public insert test_users"
  ON public.test_users
  FOR INSERT
  WITH CHECK (true);

-- Semillas iniciales
INSERT INTO public.test_users (name, surname, email) VALUES
  ('Ana',    'García',   'ana@test.com'),
  ('Luis',   'Martínez', 'luis@test.com'),
  ('María',  'López',    'maria@test.com'),
  ('Carlos', 'Ruiz',     'carlos@test.com'),
  ('Lucía',  'Fernández','lucia@test.com')
ON CONFLICT (email) DO NOTHING;
