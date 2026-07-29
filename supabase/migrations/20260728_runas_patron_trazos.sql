-- ─────────────────────────────────────────────────────────────────────────
-- Reconocimiento de runas dibujadas a mano.
--
-- Agrega a la tabla `runas` una columna jsonb que guarda los trazos de
-- referencia (uno o varios "ejemplos" de cómo se dibuja esa runa),
-- capturados desde el editor admin. Cada trazo es un array de puntos
-- {x, y} en coordenadas crudas de pantalla — la normalización (tamaño,
-- rotación, posición) se hace en el cliente al comparar, así que acá
-- se guardan tal cual se capturaron.
--
-- Forma esperada: Punto[][]  →  [[{x,y}, {x,y}, ...], [{x,y}, ...], ...]
-- ─────────────────────────────────────────────────────────────────────────

alter table public.runas
  add column if not exists patron_trazos jsonb;

comment on column public.runas.patron_trazos is
  'Trazos de referencia (array de arrays de puntos {x,y}) usados por el reconocedor $1 Unistroke para identificar la runa dibujada por un usuario.';

-- Nota: no se tocan policies de RLS acá. La tabla `runas` ya existe con
-- sus políticas de lectura pública / escritura admin definidas por fuera
-- de este repo (igual que el resto de las tablas de contenido de Garlia);
-- esta columna nueva queda cubierta automáticamente por esas mismas
-- policies de select/update ya existentes sobre la tabla.
