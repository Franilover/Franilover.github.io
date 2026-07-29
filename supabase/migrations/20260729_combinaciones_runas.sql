-- ─────────────────────────────────────────────────────────────────────────
-- Combinaciones de runas ("hechizos compuestos" por celda del tablero).
--
-- En /garlia/runas el jugador puede dividir el tablero en celdas (secciones
-- × anillos) y dibujar una runa distinta en cada una. Esta tabla, editada
-- desde admin, define qué combinaciones exactas de celda→runa producen un
-- resultado especial distinto de solo mostrar las runas individuales
-- reconocidas (ej. "Fuego" en el centro + "Agua" en el anillo exterior →
-- resultado especial "Vapor").
--
-- El match contra esta tabla es exacto y estricto: se hace en el cliente
-- (ver matchCombinacion.ts) comparando el mapa completo de celdas
-- dibujadas contra `celdas` acá — mismas celdas ocupadas, ni de más ni de
-- menos, cada una con la runa exacta.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.combinaciones_runas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  explicacion text,
  imagen_url text,
  -- Mapa celdaId → runaId, ej. {"s0-a0": "<uuid runa fuego>", "s0-a1": "<uuid runa agua>"}.
  -- Los ids de celda son los generados por generarCeldas() en formasLimite.ts
  -- (formato "s{seccion}-a{anillo}", 0-based), estables independientemente
  -- de la forma exterior elegida por el jugador (círculo/polígono).
  celdas jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.combinaciones_runas is
  'Hechizos compuestos: combinaciones exactas de runas por celda del tablero (/garlia/runas) que producen un resultado especial distinto de las runas individuales.';
comment on column public.combinaciones_runas.celdas is
  'Mapa jsonb celdaId → runaId. Match exacto y estricto contra lo dibujado por el jugador.';

alter table public.combinaciones_runas enable row level security;

-- Lectura pública: la página /garlia/runas necesita leer el catálogo
-- completo de combinaciones (incluso sin estar logueado) para poder
-- evaluar el matching en el cliente al terminar de dibujar.
create policy "combinaciones_runas: lectura pública"
  on public.combinaciones_runas for select
  using (true);

-- Escritura solo admin, mismo patrón que el resto del contenido editable
-- de Garlia (la función is_admin() ya existe en el proyecto de Supabase).
create policy "combinaciones_runas: insert admin"
  on public.combinaciones_runas for insert
  with check (is_admin());

create policy "combinaciones_runas: update admin"
  on public.combinaciones_runas for update
  using (is_admin())
  with check (is_admin());

create policy "combinaciones_runas: delete admin"
  on public.combinaciones_runas for delete
  using (is_admin());

-- Mantener updated_at al día en cada edición.
create or replace function public.combinaciones_runas_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_combinaciones_runas_updated_at on public.combinaciones_runas;
create trigger trg_combinaciones_runas_updated_at
  before update on public.combinaciones_runas
  for each row execute function public.combinaciones_runas_set_updated_at();
