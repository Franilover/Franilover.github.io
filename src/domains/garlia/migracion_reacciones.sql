-- ═══════════════════════════════════════════════════════════════════════
-- Migración: Reacciones (catálogo global) + Procesos N:N + Habilidades
-- ═══════════════════════════════════════════════════════════════════════
-- Requiere que la tabla `reacciones` ya exista (catálogo de Química).
-- Si todavía no existe, crearla primero:
--
-- CREATE TABLE IF NOT EXISTS reacciones (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   nombre text NOT NULL DEFAULT '',
--   consume jsonb NOT NULL DEFAULT '[]'::jsonb,
--   produce jsonb NOT NULL DEFAULT '[]'::jsonb,
--   descripcion text,
--   created_at timestamptz NOT NULL DEFAULT now(),
--   updated_at timestamptz NOT NULL DEFAULT now()
-- );

-- ── 1. Tabla puente Planta Proceso ↔ Reacción (N:N) ──────────────────────
CREATE TABLE IF NOT EXISTS planta_proceso_reacciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planta_proceso_id uuid NOT NULL REFERENCES planta_procesos(id) ON DELETE CASCADE,
  reaccion_id uuid NOT NULL REFERENCES reacciones(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (planta_proceso_id, reaccion_id)
);

CREATE INDEX IF NOT EXISTS idx_planta_proceso_reacciones_proceso
  ON planta_proceso_reacciones (planta_proceso_id);
CREATE INDEX IF NOT EXISTS idx_planta_proceso_reacciones_reaccion
  ON planta_proceso_reacciones (reaccion_id);

-- ── 2. Tabla puente Mineral Proceso ↔ Reacción (N:N) ─────────────────────
CREATE TABLE IF NOT EXISTS mineral_proceso_reacciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mineral_proceso_id uuid NOT NULL REFERENCES mineral_procesos(id) ON DELETE CASCADE,
  reaccion_id uuid NOT NULL REFERENCES reacciones(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mineral_proceso_id, reaccion_id)
);

CREATE INDEX IF NOT EXISTS idx_mineral_proceso_reacciones_proceso
  ON mineral_proceso_reacciones (mineral_proceso_id);
CREATE INDEX IF NOT EXISTS idx_mineral_proceso_reacciones_reaccion
  ON mineral_proceso_reacciones (reaccion_id);

-- ── 3. planta_procesos: pierde nombre/consume/produce ────────────────────
-- (confirmado como datos de prueba descartables)
ALTER TABLE planta_procesos DROP COLUMN IF EXISTS nombre;
ALTER TABLE planta_procesos DROP COLUMN IF EXISTS consume;
ALTER TABLE planta_procesos DROP COLUMN IF EXISTS produce;

-- ── 4. mineral_procesos: pierde nombre/consume/produce ───────────────────
ALTER TABLE mineral_procesos DROP COLUMN IF EXISTS nombre;
ALTER TABLE mineral_procesos DROP COLUMN IF EXISTS consume;
ALTER TABLE mineral_procesos DROP COLUMN IF EXISTS produce;

-- ── 5. item_habilidades: grupo_compuesto_id → reaccion_id ────────────────
-- Vacía los vínculos existentes (confirmado: solo dato de prueba, "Essa"),
-- así no queda una FK apuntando a filas incompatibles con la tabla nueva.
DELETE FROM item_habilidades;

ALTER TABLE item_habilidades DROP CONSTRAINT IF EXISTS item_habilidades_grupo_compuesto_id_fkey;
ALTER TABLE item_habilidades RENAME COLUMN grupo_compuesto_id TO reaccion_id;
ALTER TABLE item_habilidades
  ADD CONSTRAINT item_habilidades_reaccion_id_fkey
  FOREIGN KEY (reaccion_id) REFERENCES reacciones(id) ON DELETE CASCADE;

-- ── 6. (Opcional) Limpieza de GrupoCompuesto legado tipo="habilidad" ─────
-- Ya no se usan ni se muestran en ningún picker (ver TIPOS_GRUPO_COMPUESTO
-- en elementos/types.ts). Si querés borrarlos del catálogo de Química:
-- DELETE FROM grupos_compuestos WHERE tipo = 'habilidad';
