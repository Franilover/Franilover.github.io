-- ─────────────────────────────────────────────────────────────────────────
-- Grupos de runas (categorías libres, tipo "Naturales", "De fuego",
-- "Impacto rápido", etc.), mismo mecanismo genérico que ya usan hechizos
-- y dones vía grupos_mundo (tipo="runas" ya estaba contemplado en
-- GRUPO_TIPO_CONFIG del código, pero la tabla `runas` no tenía la columna
-- para guardar la membresía).
--
-- A diferencia de hechizos/dones (donde grupo_ids representa "grupos de
-- criaturas que pueden usar esto"), acá representa "grupos temáticos a los
-- que pertenece la runa" — el admin los crea libremente desde el editor de
-- grupos (tipo="runas") y luego los asigna aquí, en el editor de runas.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.runas
  add column if not exists grupo_ids uuid[] not null default '{}';

comment on column public.runas.grupo_ids is
  'Ids de grupos_mundo (tipo=''runas'') a los que pertenece esta runa — categorías libres definidas en admin (ej. "Naturales", "De fuego", "Impacto rápido").';
