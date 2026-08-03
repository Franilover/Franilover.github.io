-- Agrega la columna `separadores` a combinaciones_runas: mapa gapId → tipo
-- de separador exigido en ese gap, igual criterio que `celdas` (jsonb,
-- default objeto vacío). Ver types.ts (CombinacionRuna.separadores) y
-- matchCombinacion.ts para el uso.

alter table combinaciones_runas
  add column if not exists separadores jsonb not null default '{}'::jsonb;
