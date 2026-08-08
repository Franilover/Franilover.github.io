/**
 * afinidad.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Calcula la afinidad entre dos Compuestos a partir de su estructura
 * atómica real — no de reglas arbitrarias tipo "agua apaga fuego".
 *
 * Analogía con química real: el carbono tiene 4 electrones de valencia y
 * "necesita" 4 más para completar su capa externa (regla del octeto) — por
 * eso se enlaza con elementos que se los aportan (ej. 4× hidrógeno → CH4).
 *
 * Acá el mismo principio, aplicado a las 3 capas del sistema (núcleo 2 /
 * media 4 / externa 6, ver CAPACIDAD_CAPA):
 *
 *   1. Sumamos las partículas de TODOS los elementos de un compuesto,
 *      capa por capa y tipo por tipo (calcularPerfilAtomico).
 *   2. Por cada capa, comparamos el total contra su capacidad:
 *        - si suma < capacidad → DÉFICIT (le faltan partículas ahí)
 *        - si suma > capacidad → SUPERÁVIT (tiene de sobra, "sueltas")
 *        - si suma = capacidad → capa saturada, ni falta ni sobra
 *   3. Dos compuestos tienen afinidad ("se complementan") si el superávit
 *      de uno cubre el déficit del otro en la misma capa — literalmente
 *      uno le presta las partículas que al otro le faltan para
 *      estabilizarse, igual que dos elementos que se enlazan para
 *      completar su capa de valencia.
 */

import {
  CAPACIDAD_CAPA,
  type ComponenteCompuesto,
  type Compuesto,
  type Elemento,
  type LayerName,
  type ParticleMap,
  type ParticleType,
  type ResultadoAfinidad,
} from "./types";

const LAYERS: LayerName[] = ["nucleo", "media", "externa"];

/** Suma dos ParticleMap, entrada por entrada. */
function sumarParticleMap(a: ParticleMap, b: ParticleMap | undefined): ParticleMap {
  const resultado: ParticleMap = { ...a };
  for (const [tipo, cantidad] of Object.entries(b ?? {})) {
    const k = tipo as ParticleType;
    resultado[k] = (resultado[k] ?? 0) + (cantidad ?? 0);
  }
  return resultado;
}

/**
 * Perfil atómico de un compuesto: suma de las partículas de todos sus
 * elementos componentes (multiplicadas por su cantidad en la mezcla),
 * capa por capa.
 */
export interface PerfilAtomico {
  nucleo: ParticleMap;
  media: ParticleMap;
  externa: ParticleMap;
}

export function calcularPerfilAtomico(
  compuesto: Compuesto,
  elementos: Elemento[],
): PerfilAtomico {
  const perfil: PerfilAtomico = { nucleo: {}, media: {}, externa: {} };

  for (const componente of compuesto.componentes ?? []) {
    const elemento = elementos.find((e) => e.id === componente.elemento_id);
    if (!elemento) continue;
    const veces = Math.max(1, componente.cantidad ?? 1);

    for (const layer of LAYERS) {
      const capaMultiplicada: ParticleMap = {};
      for (const [tipo, cantidad] of Object.entries(elemento[layer] ?? {})) {
        capaMultiplicada[tipo as ParticleType] = (cantidad ?? 0) * veces;
      }
      perfil[layer] = sumarParticleMap(perfil[layer], capaMultiplicada);
    }
  }

  return perfil;
}

/** Déficit (falta) o superávit (sobra) de una capa contra su capacidad fija. */
export interface BalanceCapa {
  layer: LayerName;
  total: number;
  capacidad: number;
  /** Positivo = superávit (sobra), negativo = déficit (falta), 0 = saturada. */
  balance: number;
}

export function calcularBalancePorCapa(perfil: PerfilAtomico): BalanceCapa[] {
  return LAYERS.map((layer) => {
    const total = Object.values(perfil[layer]).reduce((a, b) => a + (b ?? 0), 0);
    const capacidad = CAPACIDAD_CAPA[layer];
    return { layer, total, capacidad, balance: total - capacidad };
  });
}

/**
 * Calcula la afinidad entre dos compuestos comparando sus perfiles
 * atómicos: cuánto del superávit de uno cubre el déficit del otro, capa
 * por capa.
 */
export function calcularAfinidad(
  a: Compuesto,
  b: Compuesto,
  elementos: Elemento[],
): ResultadoAfinidad {
  const perfilA = calcularPerfilAtomico(a, elementos);
  const perfilB = calcularPerfilAtomico(b, elementos);
  const balanceA = calcularBalancePorCapa(perfilA);
  const balanceB = calcularBalancePorCapa(perfilB);

  const aportes: { particula: ParticleType; cantidad: number }[] = [];
  let cubreDeficitDeB = 0;
  let cubreDeficitDeA = 0;

  for (const layer of LAYERS) {
    const balA = balanceA.find((x) => x.layer === layer)!;
    const balB = balanceB.find((x) => x.layer === layer)!;

    // Superávit de A cubriendo déficit de B en esta capa: A "le presta"
    // sus partículas sobrantes de esta capa a B.
    if (balA.balance > 0 && balB.balance < 0) {
      cubreDeficitDeB += Math.min(balA.balance, -balB.balance);
      for (const [tipo, cantidad] of Object.entries(perfilA[layer])) {
        if (!cantidad) continue;
        aportes.push({ particula: tipo as ParticleType, cantidad });
      }
    }

    // Superávit de B cubriendo déficit de A en esta capa.
    if (balB.balance > 0 && balA.balance < 0) {
      cubreDeficitDeA += Math.min(balB.balance, -balA.balance);
    }
  }

  const totalDeficitA = balanceA.filter((x) => x.balance < 0).reduce((s, x) => s + -x.balance, 0);
  const totalDeficitB = balanceB.filter((x) => x.balance < 0).reduce((s, x) => s + -x.balance, 0);
  const totalSuperavitA = balanceA.filter((x) => x.balance > 0).reduce((s, x) => s + x.balance, 0);
  const totalSuperavitB = balanceB.filter((x) => x.balance > 0).reduce((s, x) => s + x.balance, 0);

  const seComplementan = cubreDeficitDeA > 0 || cubreDeficitDeB > 0;

  if (seComplementan) {
    return {
      tipo: "complementa",
      motivo:
        cubreDeficitDeB > 0 && cubreDeficitDeA > 0
          ? `Ambos se completan mutuamente: cada uno aporta al otro las partículas que le faltan en su estructura interna.`
          : cubreDeficitDeB > 0
            ? `"${a.nombre}" tiene partículas de sobra que completan capas incompletas de "${b.nombre}" — como el carbono completando su capa externa con hidrógeno.`
            : `"${b.nombre}" tiene partículas de sobra que completan capas incompletas de "${a.nombre}" — como el carbono completando su capa externa con hidrógeno.`,
      aportes,
    };
  }

  if (totalDeficitA > 0 && totalDeficitB > 0) {
    return {
      tipo: "compite",
      motivo: `Ambos tienen capas incompletas y ninguno tiene sobrante para prestarle al otro: compiten por las mismas partículas si se combinan, en vez de estabilizarse.`,
      aportes: [],
    };
  }

  if (totalSuperavitA > 0 && totalSuperavitB > 0) {
    return {
      tipo: "saturado",
      motivo: `Ambos ya están sobrecargados en sus propias capas: combinarlos solo suma más excedente, sin estabilizar nada.`,
      aportes: [],
    };
  }

  return {
    tipo: "estable",
    motivo: `Ninguno tiene déficit ni superávit relevante frente al otro: coexisten sin reacción estructural.`,
    aportes: [],
  };
}

/**
 * Ordena una lista de compuestos por afinidad descendente respecto de uno
 * de referencia — útil para "¿con qué se complementa mejor este compuesto?".
 */
export function ordenarPorAfinidad(
  referencia: Compuesto,
  candidatos: Compuesto[],
  elementos: Elemento[],
): { compuesto: Compuesto; afinidad: ResultadoAfinidad }[] {
  const orden: Record<string, number> = { complementa: 0, estable: 1, compite: 2, saturado: 3 };
  return candidatos
    .filter((c) => c.id !== referencia.id)
    .map((c) => ({ compuesto: c, afinidad: calcularAfinidad(referencia, c, elementos) }))
    .sort((x, y) => orden[x.afinidad.tipo] - orden[y.afinidad.tipo]);
}

// ─── Sugerencias en vivo: "qué elemento agregar para reducir el déficit" ───
// Mientras se arma un compuesto, para cada elemento candidato calculamos
// cuánto de su aporte por capa efectivamente se "usaría" (no cuenta lo que
// se pasa de la capacidad, evita sugerir elementos que sobrecargan). El
// mejor candidato es el que cubre más déficit total con menos desperdicio.
export interface SugerenciaElemento {
  elemento: Elemento;
  /** Cuánto déficit total cubriría si se agrega una unidad de este elemento. */
  cubre: number;
  /** Cuánto excedente generaría (partículas que ya no caben en ninguna capa). */
  desperdicia: number;
}

export function sugerirElementosParaCompletar(
  componentesActuales: ComponenteCompuesto[],
  elementos: Elemento[],
): SugerenciaElemento[] {
  const compuestoParcial: Compuesto = {
    id: "__preview__",
    nombre: "",
    componentes: componentesActuales,
  };
  const perfilActual = calcularPerfilAtomico(compuestoParcial, elementos);
  const balanceActual = calcularBalancePorCapa(perfilActual);
  const idsElegidos = new Set(componentesActuales.map((c) => c.elemento_id));

  const candidatos: SugerenciaElemento[] = [];

  for (const elemento of elementos) {
    if (idsElegidos.has(elemento.id)) continue; // ya está en la mezcla

    let cubre = 0;
    let desperdicia = 0;

    for (const layer of LAYERS) {
      const aporte = Object.values(elemento[layer] ?? {}).reduce((a, b) => a + (b ?? 0), 0);
      if (!aporte) continue;
      const balActual = balanceActual.find((b) => b.layer === layer)!;

      if (balActual.balance < 0) {
        // Esta capa tiene déficit: el aporte primero lo cubre, el resto se desperdicia/pasa a superávit.
        const cubierto = Math.min(aporte, -balActual.balance);
        cubre += cubierto;
        desperdicia += aporte - cubierto;
      } else {
        // Ya está saturada o en superávit: todo lo que aporte acá es excedente.
        desperdicia += aporte;
      }
    }

    if (cubre > 0) {
      candidatos.push({ elemento, cubre, desperdicia });
    }
  }

  return candidatos.sort((a, b) => b.cubre - a.cubre || a.desperdicia - b.desperdicia);
}

// ─── Auto-completar hasta estable ──────────────────────────────────────────
// Greedy simple: en cada paso agrega el elemento que más déficit cubre con
// menos desperdicio, hasta que las 3 capas queden en 0 (o no haya más
// candidatos que ayuden — evita loop infinito si ningún elemento cierra
// exactamente el hueco restante).
export function autocompletarHastaEstable(
  componentesActuales: ComponenteCompuesto[],
  elementos: Elemento[],
  maxIteraciones = 12,
): ComponenteCompuesto[] {
  let componentes = componentesActuales.map((c) => ({ ...c }));

  for (let i = 0; i < maxIteraciones; i++) {
    const compuestoParcial: Compuesto = { id: "__preview__", nombre: "", componentes };
    const perfil = calcularPerfilAtomico(compuestoParcial, elementos);
    const balance = calcularBalancePorCapa(perfil);
    const estable = balance.every((b) => b.balance >= 0);
    if (estable) break; // ya no hay déficit — puede quedar superávit, pero eso es válido

    const sugerencias = sugerirElementosParaCompletar(componentes, elementos);
    if (sugerencias.length === 0) break; // nada más puede ayudar, no seguimos

    const mejor = sugerencias[0];
    const existente = componentes.find((c) => c.elemento_id === mejor.elemento.id);
    if (existente) {
      existente.cantidad += 1;
    } else {
      componentes = [...componentes, { elemento_id: mejor.elemento.id, cantidad: 1 }];
    }
  }

  return componentes;
}

// ─── Símbolo auto-generado ─────────────────────────────────────────────────
// Concatena los símbolos de los elementos componentes (orden de agregado),
// igual que una fórmula química simple (H2O, CO2). Si un elemento se repite
// más de una vez, agrega el subíndice de cantidad.
export function generarSimboloCompuesto(
  componentes: ComponenteCompuesto[],
  elementos: Elemento[],
): string {
  const partes = componentes.map((c) => {
    const el = elementos.find((e) => e.id === c.elemento_id);
    const simbolo = el?.simbolo?.trim() || "?";
    return c.cantidad > 1 ? `${simbolo}${c.cantidad}` : simbolo;
  });
  return partes.join("") || "??";
}

// ─── Detección de duplicados ───────────────────────────────────────────────
// Dos compuestos son "la misma combinación" si tienen exactamente los
// mismos elementos con las mismas cantidades (sin importar el orden).
function firmaComponentes(componentes: ComponenteCompuesto[]): string {
  return componentes
    .filter((c) => c.cantidad > 0)
    .map((c) => `${c.elemento_id}:${c.cantidad}`)
    .sort()
    .join("|");
}

export function encontrarCompuestoDuplicado(
  componentes: ComponenteCompuesto[],
  todosLosCompuestos: Compuesto[],
  excluirId?: string,
): Compuesto | null {
  if (componentes.filter((c) => c.cantidad > 0).length === 0) return null;
  const firma = firmaComponentes(componentes);
  return (
    todosLosCompuestos.find(
      (c) => c.id !== excluirId && firmaComponentes(c.componentes ?? []) === firma,
    ) ?? null
  );
}

// ─── Laboratorio: combinar dos compuestos en uno nuevo ─────────────────────
// Une los componentes de dos compuestos existentes (sumando cantidades si
// comparten algún elemento) — punto de partida para un tercer compuesto,
// en vez de armarlo desde cero. Pensado para usarse solo cuando la afinidad
// entre ambos es "complementa" (ver calcularAfinidad).
export function combinarComponentes(
  a: Compuesto,
  b: Compuesto,
): ComponenteCompuesto[] {
  const mapa = new Map<string, number>();
  for (const c of [...(a.componentes ?? []), ...(b.componentes ?? [])]) {
    mapa.set(c.elemento_id, (mapa.get(c.elemento_id) ?? 0) + c.cantidad);
  }
  return Array.from(mapa.entries()).map(([elemento_id, cantidad]) => ({
    elemento_id,
    cantidad,
  }));
}
