-- ─── reino_areas ────────────────────────────────────────────────────────────
-- Áreas (círculo/rectángulo/polígono) dibujadas sobre el mapa INTERNO de un
-- reino (ReinoTileCanvas, tiles de reino_tiles), vinculables a una ciudad de
-- ese mismo reino. Análoga a map_areas, pero scoped por reino_id en vez de
-- world_id.
--
-- Ejecutar una sola vez en Supabase (SQL editor) antes de usar la nueva
-- toolbar de áreas en el editor de mapa de reino.

create table if not exists reino_areas (
  id uuid primary key default gen_random_uuid(),
  reino_id uuid not null references reinos(id) on delete cascade,
  ciudad_id uuid references ciudades(id) on delete set null,
  tipo text not null check (tipo in ('circulo', 'rectangulo', 'poligono')),
  puntos jsonb not null,
  color text,
  label text,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists reino_areas_reino_id_idx on reino_areas(reino_id);
create index if not exists reino_areas_ciudad_id_idx on reino_areas(ciudad_id);

alter table reino_areas enable row level security;

-- Lectura pública (igual que map_areas / reino_tiles)
create policy "reino_areas_select_public" on reino_areas
  for select using (true);

-- Escritura solo para usuarios autenticados (ajustar según el esquema de
-- roles/admin ya usado por el resto de las tablas de garlia).
create policy "reino_areas_write_authenticated" on reino_areas
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
