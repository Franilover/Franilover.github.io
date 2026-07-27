// ─── calendario.ts ────────────────────────────────────────────────────────────
// Utilidad pura de conversión para el calendario del mundo.
// Sin dependencias externas — solo matemáticas.
// Las estaciones y config se cargan una vez desde Supabase y se pasan aquí.





export type Estacion = {
  id: string;
  nombre: string;
  duracion_dias: number;
  orden: number;
};





export type CalendarioConfig = {
  dias_por_semana: number;
  horas_por_dia: number;
  anio_inicio: number;
};





export type FechaMundo = {
  dia_absoluto: number;
  anio: number;
  estacion: Estacion;
  dia_en_estacion: number;  // 1-based
  semana_en_estacion: number;
  dia_en_semana: number;    // 1-based
  dia_en_anio: number;      // 1-based
};





export type FechaMundoInput = {
  anio: number;
  estacion_orden: number;   // 1-based
  dia_en_estacion: number;  // 1-based
};

// ─── Calcular días totales por año ────────────────────────────────────────────




export function diasPorAnio(estaciones: Estacion[]): number {
  return estaciones.reduce((sum, e) => sum + e.duracion_dias, 0);
}

// ─── Día absoluto → FechaMundo ────────────────────────────────────────────────




export function diaAbsolutoAFecha(
  diaAbsoluto: number,
  estaciones: Estacion[],
  config: CalendarioConfig,
): FechaMundo {
  const estOrdenadas = [...estaciones].sort((a, b) => a.orden - b.orden);
  const totalDias = diasPorAnio(estOrdenadas);

  const anio = config.anio_inicio + Math.floor(diaAbsoluto / totalDias);
  let resto = diaAbsoluto % totalDias; // día dentro del año (0-based)
  const diaEnAnio = resto + 1;

  let estacionActual = estOrdenadas[0];
  let diaEnEstacion = 1;

  for (const est of estOrdenadas) {
    if (resto < est.duracion_dias) {
      estacionActual = est;
      diaEnEstacion = resto + 1;
      break;
    }
    resto -= est.duracion_dias;
  }

  const semanaEnEstacion = Math.floor((diaEnEstacion - 1) / config.dias_por_semana) + 1;
  const diaEnSemana = ((diaEnEstacion - 1) % config.dias_por_semana) + 1;

  return {
    dia_absoluto: diaAbsoluto,
    anio,
    estacion: estacionActual,
    dia_en_estacion: diaEnEstacion,
    semana_en_estacion: semanaEnEstacion,
    dia_en_semana: diaEnSemana,
    dia_en_anio: diaEnAnio,
  };
}

// ─── FechaMundoInput → día absoluto ───────────────────────────────────────────




export function fechaADiaAbsoluto(
  input: FechaMundoInput,
  estaciones: Estacion[],
  config: CalendarioConfig,
): number {
  const estOrdenadas = [...estaciones].sort((a, b) => a.orden - b.orden);
  const totalDias = diasPorAnio(estOrdenadas);

  const diasDeAnios = (input.anio - config.anio_inicio) * totalDias;

  let diasDeEstaciones = 0;
  for (const est of estOrdenadas) {
    if (est.orden >= input.estacion_orden) break;
    diasDeEstaciones += est.duracion_dias;
  }

  const diasDeDias = input.dia_en_estacion - 1;

  return diasDeAnios + diasDeEstaciones + diasDeDias;
}

// ─── Formato legible ──────────────────────────────────────────────────────────




export function formatFechaMundo(fecha: FechaMundo, _config: CalendarioConfig): string {
  return `Año ${fecha.anio} · ${fecha.estacion.nombre} · Semana ${fecha.semana_en_estacion} · Día ${fecha.dia_en_semana}`;
}





export function formatFechaCorta(fecha: FechaMundo): string {
  return `Año ${fecha.anio}, ${fecha.estacion.nombre} día ${fecha.dia_en_estacion}`;
}

// ─── Era del mundo en un día absoluto ────────────────────────────────────────




export type EraMundo = {
  id: string;
  nombre: string;
  anio_inicio: number;
  anio_fin: number | null;
  color: string | null;
  descripcion: string | null;
};





export function eraEnAnio(anio: number, eras: EraMundo[]): EraMundo | null {
  return eras.find(e =>
    anio >= e.anio_inicio && (e.anio_fin == null || anio <= e.anio_fin)
  ) ?? null;
}