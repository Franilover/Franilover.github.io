-- ═══════════════════════════════════════════════════════════════════════
-- migracion_grupos_compuestos_unificacion.sql
-- ───────────────────────────────────────────────────────────────────────
-- Unifica "Organo" (Flora) y "MineralFormacion" (Minerales) bajo
-- grupos_compuestos, usando la nueva columna `tipo` como tag
-- ('organo' | 'formacion' | 'generico').
--
-- Después de correr esto:
--   - organos                      → filas migradas a grupos_compuestos
--                                     (tipo='organo'), tabla vieja se
--                                     puede dropear al final.
--   - planta_organos.organo_id     → renombrada a grupo_compuesto_id,
--                                     apuntando ahora a grupos_compuestos.
--   - mineral_formaciones          → deja de ser fila-completa (nombre/
--                                     componentes/notas propios) y pasa a
--                                     ser tabla puente pura (igual que
--                                     planta_organos): sus datos se migran
--                                     a filas nuevas en grupos_compuestos
--                                     (tipo='formacion') + un vínculo.
--
-- Ejecutar en orden, dentro de una transacción. Revisar los SELECT de
-- verificación al final antes de correr los DROP.
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Columna `tipo` en grupos_compuestos ────────────────────────────
alter table grupos_compuestos
  add column if not exists tipo text not null default 'generico'
  check (tipo in ('generico', 'organo', 'formacion'));

-- ── 2. Migrar catálogo de Organo → grupos_compuestos (tipo='organo') ──
-- Se preserva el id original para no tener que remapear planta_organos
-- en un segundo paso — el id de "organos" pasa a ser el id de la fila
-- nueva en grupos_compuestos.
insert into grupos_compuestos (id, nombre, notas, componentes, tipo, created_at, updated_at)
select
  o.id,
  o.nombre,
  o.notas,
  coalesce(o.componentes, '[]'::jsonb),
  'organo',
  o.created_at,
  o.updated_at
from organos o
where not exists (
  select 1 from grupos_compuestos g where g.id = o.id
);

-- ── 3. Tabla puente planta_organos: renombrar FK ───────────────────────
alter table planta_organos
  rename column organo_id to grupo_compuesto_id;

alter table planta_organos
  drop constraint if exists planta_organos_organo_id_fkey;

alter table planta_organos
  add constraint planta_organos_grupo_compuesto_id_fkey
  foreign key (grupo_compuesto_id) references grupos_compuestos(id) on delete cascade;

-- ── 4. Migrar mineral_formaciones (fila-completa → grupo + vínculo) ────
-- Cada fila vieja de mineral_formaciones se convierte en:
--   (a) una fila nueva en grupos_compuestos (tipo='formacion') con su
--       nombre/componentes/notas, y
--   (b) el vínculo correspondiente en la NUEVA mineral_formaciones
--       (mineral_id, grupo_compuesto_id).
-- Se hace en una tabla temporal primero, porque la tabla destino
-- (mineral_formaciones) es la misma que la fuente y cambia de forma.

create temporary table _mig_formaciones as
select
  mf.id as vinculo_id_original,
  mf.mineral_id,
  mf.nombre,
  mf.componentes,
  mf.notas,
  mf.created_at,
  mf.updated_at,
  gen_random_uuid() as nuevo_grupo_id
from mineral_formaciones mf;

insert into grupos_compuestos (id, nombre, notas, componentes, tipo, created_at, updated_at)
select
  nuevo_grupo_id,
  nombre,
  notas,
  coalesce(componentes, '[]'::jsonb),
  'formacion',
  created_at,
  updated_at
from _mig_formaciones;

-- Recrear mineral_formaciones como tabla puente pura.
alter table mineral_formaciones rename to mineral_formaciones_legado;

create table mineral_formaciones (
  id uuid primary key default gen_random_uuid(),
  mineral_id uuid not null references minerales(id) on delete cascade,
  grupo_compuesto_id uuid not null references grupos_compuestos(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into mineral_formaciones (id, mineral_id, grupo_compuesto_id, created_at)
select vinculo_id_original, mineral_id, nuevo_grupo_id, created_at
from _mig_formaciones;

drop table _mig_formaciones;

-- ── 5. Verificación antes de dropear las tablas viejas ─────────────────
-- Correr estos SELECT y confirmar que los conteos coinciden antes de
-- seguir con el paso 6.
--
--   select count(*) from organos;
--   select count(*) from grupos_compuestos where tipo = 'organo';
--
--   select count(*) from mineral_formaciones_legado;
--   select count(*) from mineral_formaciones;
--   select count(*) from grupos_compuestos where tipo = 'formacion';

commit;

-- ═══════════════════════════════════════════════════════════════════════
-- PASO MANUAL — correr por separado después de verificar los conteos:
--
--   drop table organos;
--   drop table mineral_formaciones_legado;
--
-- No se incluyen en la transacción de arriba a propósito: son
-- irreversibles y conviene confirmarlos a mano después de revisar la
-- app funcionando contra el nuevo esquema.
-- ═══════════════════════════════════════════════════════════════════════
