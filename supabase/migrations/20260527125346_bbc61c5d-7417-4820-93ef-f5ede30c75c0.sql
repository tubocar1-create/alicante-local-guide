create table if not exists public.agente_respuestas (
  intent_id text primary key,
  question text not null,
  updated_at timestamptz not null default now()
);

grant select on public.agente_respuestas to anon, authenticated;
grant all on public.agente_respuestas to service_role;

alter table public.agente_respuestas enable row level security;

create policy "agente_respuestas_public_read"
  on public.agente_respuestas for select
  using (true);

create policy "agente_respuestas_admin_write"
  on public.agente_respuestas for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

create trigger set_agente_respuestas_updated_at
  before update on public.agente_respuestas
  for each row execute function public.update_updated_at_column();

insert into public.agente_respuestas (intent_id, question) values
  ('salud',               'Entiendo. ¿Necesitas hospital, farmacia, urgencias o especialista?'),
  ('comer',               '¿Buscas restaurante, tapas, paella o algo rápido?'),
  ('transporte',          '🚍 ¿Quieres ir en bus urbano o en TRAM (tranvía)?'),
  ('transporte_bus',      '🚌 ¿Ya sabes qué bus tomar? Dime «sí, lo sé» y te pregunto la línea, o «ayúdame» y planificamos la ruta.'),
  ('bus_known',           'Perfecto. ¿Cuál es la línea que quieres tomar? (por ejemplo: 22, 7, 13N…)'),
  ('tram_pick',           '🚋 ¿Hacia qué estación del TRAM quieres ir?'),
  ('tram_origin_confirm', '¿Quieres salir desde esa parada o prefieres otra?'),
  ('fiestas',             '¡Vamos! ¿Quieres ver el programa de fiestas, hogueras o moros y cristianos?'),
  ('tomar_algo',          '🍸 ¿Prefieres terraza, pubs, discoteca o música en vivo?'),
  ('ocio',                '¿Te apetece cine, conciertos, teatro o fiestas?'),
  ('playas',              '¿Prefieres ver el carrusel de playas o abrir el mapa interactivo?'),
  ('dormir',              '¿Buscas hotel, hostal o apartamento?'),
  ('compras',             'Genial, aquí te dejo una lista muy amplia de sitios para comprar, pero si lo prefieres te puedo orientar si me dices qué artículo o servicio necesitas.'),
  ('mapa',                'Aquí tienes el mapa interactivo de playas. Llámame luego si quieres más información.'),
  ('clima',               '🌤️ Te llevo al clima de Alicante.'),
  ('perfil',              '👤 Te llevo a tu perfil.')
on conflict (intent_id) do nothing;