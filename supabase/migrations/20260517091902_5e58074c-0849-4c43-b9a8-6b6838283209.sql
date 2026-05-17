
-- Create health_centers table
CREATE TABLE public.health_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  service_type text NOT NULL, -- 'hospital' | 'centro_salud' | 'consultorio' | 'urgencias' | 'especialidades' | 'farmacia'
  specialties text[] NOT NULL DEFAULT '{}',
  address text,
  municipality text NOT NULL,
  phone text,
  schedule text,
  health_department text, -- 'Alicante' | 'Sant Joan' | etc.
  associated_services text[] NOT NULL DEFAULT '{}',
  website text,
  lat double precision,
  lng double precision,
  source_url text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.health_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read health_centers"
ON public.health_centers FOR SELECT
USING (true);

CREATE POLICY "Admins manage health_centers"
ON public.health_centers FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_health_centers_updated_at
BEFORE UPDATE ON public.health_centers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_health_centers_type ON public.health_centers(service_type);
CREATE INDEX idx_health_centers_municipality ON public.health_centers(municipality);
CREATE INDEX idx_health_centers_department ON public.health_centers(health_department);

-- Seed initial data (official sources: san.gva.es, alicante.san.gva.es, sanjuan.san.gva.es)
INSERT INTO public.health_centers (name, service_type, specialties, address, municipality, phone, schedule, health_department, associated_services, website, source_url, notes) VALUES
('Hospital General Universitario Doctor Balmis', 'hospital', ARRAY['Cardiología','Pediatría','Oncología','Traumatología','Ginecología','Neurología','Urgencias 24h'], 'Calle Pintor Baeza, 11', 'Alicante', '965 933 000', '24 horas (Urgencias). Consultas externas L-V 8:00-15:00', 'Departamento de Salud Alicante - Hospital General', ARRAY['Laboratorio','Radiología','Urgencias','UCI','Farmacia hospitalaria'], 'https://alicante.san.gva.es', 'https://alicante.san.gva.es', 'Hospital de referencia del Departamento de Salud Alicante.'),
('Hospital Universitario de Sant Joan d''Alacant', 'hospital', ARRAY['Medicina interna','Cirugía','Pediatría','Ginecología','Cardiología','Oncología','Urgencias 24h'], 'Carretera Nacional 332, s/n', 'Sant Joan d''Alacant', '965 938 700', '24 horas (Urgencias). Consultas externas L-V 8:00-15:00', 'Departamento de Salud Sant Joan', ARRAY['Laboratorio','Radiología','Urgencias','UCI','Rehabilitación'], 'https://sanjuan.san.gva.es', 'https://sanjuan.san.gva.es', 'Hospital de referencia del Departamento de Salud Sant Joan.'),
('Centro de Salud Alicante - Babel', 'centro_salud', ARRAY['Medicina familiar','Pediatría','Enfermería','Matrona'], 'Calle Pintor Murillo, 2', 'Alicante', '966 908 250', 'L-V 8:00-20:00', 'Departamento de Salud Alicante - Hospital General', ARRAY['Extracciones','Vacunación','Curas'], 'https://alicante.san.gva.es', 'https://alicante.san.gva.es', NULL),
('Centro de Salud Alicante - Campoamor', 'centro_salud', ARRAY['Medicina familiar','Pediatría','Enfermería'], 'Calle Pardo Gimeno, 14', 'Alicante', '966 908 300', 'L-V 8:00-20:00', 'Departamento de Salud Alicante - Hospital General', ARRAY['Extracciones','Vacunación'], 'https://alicante.san.gva.es', 'https://alicante.san.gva.es', NULL),
('Centro de Salud Alicante - Cabo Huertas', 'centro_salud', ARRAY['Medicina familiar','Pediatría','Enfermería'], 'Avenida Costa Blanca, 153', 'Alicante', '966 908 100', 'L-V 8:00-20:00', 'Departamento de Salud Sant Joan', ARRAY['Extracciones','Vacunación'], 'https://sanjuan.san.gva.es', 'https://sanjuan.san.gva.es', NULL),
('Centro de Salud Alicante - Florida-Babel', 'centro_salud', ARRAY['Medicina familiar','Pediatría','Enfermería','Matrona'], 'Calle Asilo, 32', 'Alicante', '966 908 280', 'L-V 8:00-20:00', 'Departamento de Salud Alicante - Hospital General', ARRAY['Extracciones','Vacunación','Curas'], 'https://alicante.san.gva.es', 'https://alicante.san.gva.es', NULL),
('Centro de Salud Alicante - Gran Vía', 'centro_salud', ARRAY['Medicina familiar','Pediatría','Enfermería'], 'Gran Vía, 28', 'Alicante', '966 908 220', 'L-V 8:00-20:00', 'Departamento de Salud Alicante - Hospital General', ARRAY['Extracciones','Vacunación'], 'https://alicante.san.gva.es', 'https://alicante.san.gva.es', NULL),
('Centro de Salud Alicante - Lo Morant', 'centro_salud', ARRAY['Medicina familiar','Pediatría','Enfermería'], 'Calle Olof Palme, 1', 'Alicante', '966 908 350', 'L-V 8:00-20:00', 'Departamento de Salud Alicante - Hospital General', ARRAY['Extracciones','Vacunación'], 'https://alicante.san.gva.es', 'https://alicante.san.gva.es', NULL),
('Centro de Salud Sant Joan d''Alacant', 'centro_salud', ARRAY['Medicina familiar','Pediatría','Enfermería','Matrona'], 'Calle Pintor Baeza, s/n', 'Sant Joan d''Alacant', '966 909 470', 'L-V 8:00-20:00', 'Departamento de Salud Sant Joan', ARRAY['Extracciones','Vacunación','Curas'], 'https://sanjuan.san.gva.es', 'https://sanjuan.san.gva.es', NULL),
('Centro de Salud El Campello', 'centro_salud', ARRAY['Medicina familiar','Pediatría','Enfermería'], 'Calle Coixera, 4', 'El Campello', '966 909 280', 'L-V 8:00-20:00', 'Departamento de Salud Sant Joan', ARRAY['Extracciones','Vacunación'], 'https://sanjuan.san.gva.es', 'https://sanjuan.san.gva.es', NULL),
('Centro de Salud Mutxamel', 'centro_salud', ARRAY['Medicina familiar','Pediatría','Enfermería'], 'Avenida Carlos Soler, 64', 'Mutxamel', '966 909 380', 'L-V 8:00-20:00', 'Departamento de Salud Sant Joan', ARRAY['Extracciones','Vacunación'], 'https://sanjuan.san.gva.es', 'https://sanjuan.san.gva.es', NULL),
('Punto de Atención Continuada (PAC) Babel', 'urgencias', ARRAY['Urgencias atención primaria'], 'Calle Pintor Murillo, 2', 'Alicante', '966 908 250', 'L-V 20:00-8:00, fines de semana y festivos 24h', 'Departamento de Salud Alicante - Hospital General', ARRAY['Urgencias no hospitalarias'], 'https://alicante.san.gva.es', 'https://alicante.san.gva.es', 'Atención fuera del horario habitual del centro de salud.'),
('Centro de Especialidades Babel', 'especialidades', ARRAY['Dermatología','Oftalmología','Otorrinolaringología','Traumatología','Cardiología'], 'Calle Pintor Murillo, 2', 'Alicante', '966 908 200', 'L-V 8:00-15:00', 'Departamento de Salud Alicante - Hospital General', ARRAY['Pruebas diagnósticas','Consultas externas'], 'https://alicante.san.gva.es', 'https://alicante.san.gva.es', 'Consultas de especialidades por derivación desde Atención Primaria.');
