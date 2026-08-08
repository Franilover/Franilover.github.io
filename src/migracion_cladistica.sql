-- ─────────────────────────────────────────────────────────────────────────
-- Migración: Taxonomía linneana → Cladística (grupos monofiléticos)
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Nueva tabla "clados"
create table if not exists public.clados (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null default '',
  sinapomorfia text not null default '',
  padre_id     uuid references public.clados(id) on delete set null,
  descripcion  text not null default '',
  criatura_ids uuid[] not null default '{}',
  orden        integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists clados_padre_id_idx on public.clados(padre_id);

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_clados_updated_at on public.clados;
create trigger trg_clados_updated_at
  before update on public.clados
  for each row execute function public.set_updated_at();

-- RLS — ajustá las políticas según cómo tengas el resto de tus tablas
-- (ejemplo abierto a usuarios autenticados; cambiá si usás otro esquema)
alter table public.clados enable row level security;

create policy "clados_select" on public.clados
  for select using (true);
create policy "clados_insert" on public.clados
  for insert with check (auth.role() = 'authenticated');
create policy "clados_update" on public.clados
  for update using (auth.role() = 'authenticated');
create policy "clados_delete" on public.clados
  for delete using (auth.role() = 'authenticated');

-- 2. Migrar datos existentes de "taxones" → "clados" (si la tabla vieja existe)
insert into public.clados (id, nombre, sinapomorfia, padre_id, descripcion, criatura_ids, orden, created_at, updated_at)
select id, nombre, '' as sinapomorfia, padre_id, descripcion, criatura_ids, orden, created_at, updated_at
from public.taxones
on conflict (id) do nothing;

-- 3. Limpieza de lo viejo (solo después de confirmar que la migración de datos salió bien)
drop table if exists public.taxones cascade;
drop table if exists public.biologia_config cascade;
