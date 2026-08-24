-- Fase 6 — Reacciones → Procesos → Fenómenos
-- Idempotente donde es posible. La migración preserva temporalmente los
-- antiguos compuestos Fuego/Rayo en una tabla de respaldo antes de retirarlos.

begin;

-- -------------------------------------------------------------------------
-- 1. Reacciones: garantizar que reaccion_componentes sea la fuente de verdad
-- -------------------------------------------------------------------------

create table if not exists reaccion_componentes (
  id uuid primary key default gen_random_uuid(),
  reaccion_id uuid not null references reacciones(id) on delete cascade,
  entidad_tipo text not null,
  entidad_id uuid not null,
  direccion text not null,
  cantidad integer not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_reaccion_componentes_reaccion
  on reaccion_componentes(reaccion_id);
create index if not exists idx_reaccion_componentes_entidad
  on reaccion_componentes(entidad_tipo, entidad_id);

-- Si una instancia antigua todavía no fue migrada, la recuperamos del JSONB.
-- Esto hace que la migración sea segura también contra bases que hayan quedado
-- a mitad de la Fase 6.
insert into reaccion_componentes (reaccion_id, entidad_tipo, entidad_id, direccion, cantidad)
select r.id, x.tipo, x.id, 'reactivo', x.cantidad
from reacciones r
cross join lateral jsonb_to_recordset(coalesce(r.consume, '[]'::jsonb))
  as x(tipo text, id uuid, cantidad integer)
where not exists (
  select 1 from reaccion_componentes rc
  where rc.reaccion_id = r.id
    and rc.entidad_tipo = x.tipo
    and rc.entidad_id = x.id
    and rc.direccion = 'reactivo'
    and rc.cantidad = x.cantidad
);

insert into reaccion_componentes (reaccion_id, entidad_tipo, entidad_id, direccion, cantidad)
select r.id, x.tipo, x.id, 'producto', x.cantidad
from reacciones r
cross join lateral jsonb_to_recordset(coalesce(r.produce, '[]'::jsonb))
  as x(tipo text, id uuid, cantidad integer)
where not exists (
  select 1 from reaccion_componentes rc
  where rc.reaccion_id = r.id
    and rc.entidad_tipo = x.tipo
    and rc.entidad_id = x.id
    and rc.direccion = 'producto'
    and rc.cantidad = x.cantidad
);

-- No debe haber entradas inválidas antes de retirar el JSONB.
do $$
begin
  if exists (
    select 1 from reaccion_componentes
    where entidad_tipo not in ('elemento', 'compuesto')
       or direccion not in ('reactivo', 'producto')
       or cantidad <= 0
  ) then
    raise exception 'Fase 6: hay filas inválidas en reaccion_componentes';
  end if;
end $$;

-- -------------------------------------------------------------------------
-- 2. Procesos y vínculo N:M con reacciones
-- -------------------------------------------------------------------------

create table if not exists procesos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text,
  descripcion text,
  condiciones text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists proceso_reacciones (
  id uuid primary key default gen_random_uuid(),
  proceso_id uuid not null references procesos(id) on delete cascade,
  reaccion_id uuid not null references reacciones(id) on delete cascade,
  orden integer,
  rol text,
  created_at timestamptz not null default now()
);

create index if not exists idx_proceso_reacciones_proceso
  on proceso_reacciones(proceso_id, orden);
create index if not exists idx_proceso_reacciones_reaccion
  on proceso_reacciones(reaccion_id);

-- -------------------------------------------------------------------------
-- 3. Fenómenos: separación definitiva de Fuego/Rayo de Compuestos
-- -------------------------------------------------------------------------

create table if not exists fenomeno_procesos (
  id uuid primary key default gen_random_uuid(),
  fenomeno_id uuid not null references fenomenos(id) on delete cascade,
  proceso_id uuid not null references procesos(id) on delete cascade,
  rol text,
  created_at timestamptz not null default now(),
  unique (fenomeno_id, proceso_id)
);

create index if not exists idx_fenomeno_procesos_fenomeno
  on fenomeno_procesos(fenomeno_id);
create index if not exists idx_fenomeno_procesos_proceso
  on fenomeno_procesos(proceso_id);

-- La composición de un fenómeno ya no es una composición de "compuesto".
-- La conservamos como influencia/constitución material explícita.
create table if not exists fenomeno_elementos (
  id uuid primary key default gen_random_uuid(),
  fenomeno_id uuid not null references fenomenos(id) on delete cascade,
  elemento_id uuid not null references elementos(id) on delete restrict,
  cantidad integer not null,
  rol text,
  created_at timestamptz not null default now(),
  unique (fenomeno_id, elemento_id, rol)
);

create index if not exists idx_fenomeno_elementos_fenomeno
  on fenomeno_elementos(fenomeno_id);

-- Respaldo de los dos registros antes de retirar su identidad de Compuesto.
create table if not exists fase6_compuestos_fenomenos_backup (
  compuesto_id uuid primary key,
  nombre text not null,
  simbolo text,
  notas text,
  componentes jsonb,
  sustancia_base_id uuid,
  estado text,
  es_fenomeno boolean,
  migrated_at timestamptz not null default now()
);

insert into fase6_compuestos_fenomenos_backup
  (compuesto_id, nombre, simbolo, notas, componentes, sustancia_base_id, estado, es_fenomeno)
select id, nombre, simbolo, notas, componentes, sustancia_base_id, estado, es_fenomeno
from compuestos
where es_fenomeno = true
on conflict (compuesto_id) do nothing;

-- Copiar la composición elemental existente de Fuego/Rayo.
insert into fenomeno_elementos (fenomeno_id, elemento_id, cantidad, rol)
select f.id, ce.elemento_id, ce.cantidad, 'constituyente'
from fenomenos f
join compuestos c on c.nombre = f.nombre and c.es_fenomeno = true
join compuesto_elementos ce on ce.compuesto_id = c.id
on conflict (fenomeno_id, elemento_id, rol) do update
set cantidad = excluded.cantidad;

-- -------------------------------------------------------------------------
-- 4. Crear el proceso causal mínimo para Fuego y Rayo.
-- No inventamos una ecuación química artificial: el proceso puede existir
-- antes de que tenga una o varias reacciones asociadas.
-- -------------------------------------------------------------------------

insert into procesos (nombre, tipo, descripcion, notas)
select 'Combustión activa', 'manifestacion', f.notas,
       'Proceso asociado al fenómeno Fuego durante la Fase 6. Las reacciones concretas se vincularán cuando exista una ecuación física definida.'
from fenomenos f
where f.nombre = 'Fuego'
  and not exists (select 1 from procesos p where p.nombre = 'Combustión activa');

insert into procesos (nombre, tipo, descripcion, notas)
select 'Descarga eléctrica', 'manifestacion', f.notas,
       'Proceso asociado al fenómeno Rayo durante la Fase 6. Las reacciones concretas se vincularán cuando exista una ecuación física definida.'
from fenomenos f
where f.nombre = 'Rayo'
  and not exists (select 1 from procesos p where p.nombre = 'Descarga eléctrica');

insert into fenomeno_procesos (fenomeno_id, proceso_id, rol)
select f.id, p.id, 'manifestacion'
from fenomenos f
join procesos p on p.nombre = case f.nombre
  when 'Fuego' then 'Combustión activa'
  when 'Rayo' then 'Descarga eléctrica'
end
where f.nombre in ('Fuego', 'Rayo')
on conflict (fenomeno_id, proceso_id) do nothing;

-- La relación antigua 1:1 ya no es necesaria: la nueva tabla permite N:M.
-- Se deja el dato solo hasta que la migración termina; después se elimina.

-- -------------------------------------------------------------------------
-- 5. Eliminar la identidad de Fuego/Rayo como Compuestos.
-- No hay referencias FK activas a estos dos IDs fuera de su composición.
-- -------------------------------------------------------------------------

delete from compuesto_tags
where compuesto_id in (
  select id from compuestos where es_fenomeno = true
);

delete from compuesto_elementos
where compuesto_id in (
  select id from compuestos where es_fenomeno = true
);

delete from compuestos
where es_fenomeno = true;

alter table fenomenos drop column if exists proceso_id;
alter table compuestos drop column if exists es_fenomeno;

-- -------------------------------------------------------------------------
-- 6. Retirar JSONB de Reacciones.
-- El frontend ya usa reaccion_componentes y los datos fueron validados.
-- -------------------------------------------------------------------------

alter table reacciones drop column if exists consume;
alter table reacciones drop column if exists produce;

commit;
