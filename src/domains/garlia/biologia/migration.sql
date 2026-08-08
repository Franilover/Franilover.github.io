-- Migración del módulo Biología
-- Ejecutar en Supabase (SQL editor). No toca ninguna tabla existente
-- (criaturas, elementos, oris) — solo referencia sus ids como texto/uuid.

-- Config de rangos taxonómicos (una sola fila viva)
create table if not exists biologia_config (
  id uuid primary key default gen_random_uuid(),
  rangos jsonb not null default '["Reino","Filo","Clase","Orden","Familia","Género","Especie"]'::jsonb
);

-- Árbol filogenético
create table if not exists taxones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null default '',
  rango text not null default 'Reino',
  padre_id uuid references taxones(id) on delete set null,
  descripcion text not null default '',
  criatura_ids jsonb not null default '[]'::jsonb,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_taxones_padre_id on taxones(padre_id);

-- Ecosistemas
create table if not exists ecosistemas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null default '',
  bioma text not null default '',
  clima text not null default '',
  descripcion text not null default '',
  criatura_ids jsonb not null default '[]'::jsonb,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cadenas alimenticias
create table if not exists cadenas_alimenticias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null default '',
  ecosistema_id uuid references ecosistemas(id) on delete set null,
  descripcion text not null default '',
  eslabones jsonb not null default '[]'::jsonb,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_cadenas_ecosistema_id on cadenas_alimenticias(ecosistema_id);

-- Perfil atómico de criatura ("compuesto vivo")
create table if not exists perfiles_atomicos_criatura (
  id uuid primary key default gen_random_uuid(),
  criatura_id uuid not null references criaturas(id) on delete cascade,
  componentes jsonb not null default '[]'::jsonb,
  oris_ids jsonb not null default '[]'::jsonb,
  notas text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (criatura_id)
);

-- updated_at automático (reusa la función si ya existe en el proyecto;
-- si no existe, este bloque la crea)
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_taxones_updated_at on taxones;
create trigger trg_taxones_updated_at before update on taxones
  for each row execute function set_updated_at();

drop trigger if exists trg_ecosistemas_updated_at on ecosistemas;
create trigger trg_ecosistemas_updated_at before update on ecosistemas
  for each row execute function set_updated_at();

drop trigger if exists trg_cadenas_updated_at on cadenas_alimenticias;
create trigger trg_cadenas_updated_at before update on cadenas_alimenticias
  for each row execute function set_updated_at();

drop trigger if exists trg_perfiles_atomicos_updated_at on perfiles_atomicos_criatura;
create trigger trg_perfiles_atomicos_updated_at before update on perfiles_atomicos_criatura
  for each row execute function set_updated_at();
