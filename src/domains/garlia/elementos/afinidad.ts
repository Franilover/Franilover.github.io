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
 * Acá el mismo principio, aplicado a las 3 capas del sistema. Núcleo (2) y
 * Media (4) tienen capacidad fija (CAPACIDAD_CAPA_FIJA). La Externa NO:
 * su techo depende del armónico de cada elemento según su número atómico
 * (Ley de Expansión por Cierre de Noble, ver capacidadExterna en types.ts) —
 * por eso la "capacidad" de externa de un compuesto es la SUMA de los
 * techos individuales de sus elementos componentes, igual que se suman
 * sus partículas:
 *
 *   1. Sumamos las partículas de TODOS los elementos de un compuesto,
 *      capa por capa y tipo por tipo (calcularPerfilAtomico) — y también
 *      sumamos el techo de externa de cada elemento (capacidadExternaTotal).
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
  CAPACIDAD_CAPA_FIJA,
  capacidadExterna,
  type ComponenteCompuesto,
  type Compuesto,
  type Elemento,
  type ElementFamily,
  type LayerName,
  type NivelReactividad,
  type ParticleMap,
  type ParticleType,
  type ResultadoAfinidad,
  type ResultadoCancelacionCarga,
  type ResultadoElectromagnetismo,
  type ResultadoEnlace,
  type ResultadoEstequiometria,
  type ResultadoPeso,
  type ResultadoReactividad,
  type TipoEnlace,
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
 * capa por capa. Incluye además capacidadExternaTotal: la suma de los
 * techos individuales de Externa de cada elemento (ya que ese techo
 * depende del armónico/Z de cada uno, no es un valor fijo por compuesto).
 */
export interface PerfilAtomico {
  nucleo: ParticleMap;
  media: ParticleMap;
  externa: ParticleMap;
  capacidadExternaTotal: number;
}

export function calcularPerfilAtomico(
  compuesto: Compuesto,
  elementos: Elemento[],
): PerfilAtomico {
  const perfil: PerfilAtomico = { nucleo: {}, media: {}, externa: {}, capacidadExternaTotal: 0 };

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

    perfil.capacidadExternaTotal += capacidadExterna(elemento.numero_atomico) * veces;
  }

  return perfil;
}

/** Déficit (falta) o superávit (sobra) de una capa contra su capacidad. */
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
    // Núcleo/Media: capacidad fija. Externa: suma de techos por elemento
    // (armónico según Z), ya calculada en calcularPerfilAtomico.
    const capacidad = layer === "externa" ? perfil.capacidadExternaTotal : CAPACIDAD_CAPA_FIJA[layer];
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

// ─── Ley de Cancelación de Carga (Voluntad ↔ Percepción) ───────────────────
// Dos compuestos son compatibles si la Voluntad libre de uno cancela los
// huecos de Percepción del otro, 1 a 1 (ver reglas-sistema-actualizado.md).
// Se calcula en ambas direcciones porque no es simétrico: A puede tener
// mucha Voluntad y poca Percepción, y B al revés.
export function calcularCancelacionCarga(
  a: Compuesto,
  b: Compuesto,
  elementos: Elemento[],
): ResultadoCancelacionCarga {
  const perfilA = calcularPerfilAtomico(a, elementos);
  const perfilB = calcularPerfilAtomico(b, elementos);

  const voluntadA = perfilA.externa.Voluntad ?? 0;
  const percepcionA = perfilA.externa.Percepción ?? 0;
  const voluntadB = perfilB.externa.Voluntad ?? 0;
  const percepcionB = perfilB.externa.Percepción ?? 0;

  const voluntadAaPercepcionB = Math.min(voluntadA, percepcionB);
  const voluntadBaPercepcionA = Math.min(voluntadB, percepcionA);

  return {
    voluntadAaPercepcionB,
    voluntadBaPercepcionA,
    compatible: voluntadAaPercepcionB > 0 || voluntadBaPercepcionA > 0,
  };
}

/** Misma cancelación de carga, pero para dos Elementos sueltos (sin armar Compuesto). */
export function calcularCancelacionCargaElementos(
  a: Elemento,
  b: Elemento,
): ResultadoCancelacionCarga {
  const compuestoA: Compuesto = { id: a.id, nombre: a.nombre, componentes: [{ elemento_id: a.id, cantidad: 1 }] };
  const compuestoB: Compuesto = { id: b.id, nombre: b.nombre, componentes: [{ elemento_id: b.id, cantidad: 1 }] };
  return calcularCancelacionCarga(compuestoA, compuestoB, [a, b]);
}

// ─── Enlace Resultante (Transición vs Catálisis) ───────────────────────────
// Igualadas las cargas, la proporción entre Transición y Catálisis de AMBOS
// compuestos combinados determina si el enlace es fuerte/permanente
// (predominio de Catálisis) o débil/metaestable (predominio de Transición).
export function calcularEnlaceResultante(
  a: Compuesto,
  b: Compuesto,
  elementos: Elemento[],
): ResultadoEnlace {
  const perfilA = calcularPerfilAtomico(a, elementos);
  const perfilB = calcularPerfilAtomico(b, elementos);

  const totalTransicion = (perfilA.externa.Transición ?? 0) + (perfilB.externa.Transición ?? 0);
  const totalCatalisis = (perfilA.externa.Catálisis ?? 0) + (perfilB.externa.Catálisis ?? 0);

  let tipo: TipoEnlace;
  if (totalCatalisis > totalTransicion) tipo = "fuerte";
  else if (totalTransicion > totalCatalisis) tipo = "debil";
  else tipo = "neutro";

  return { tipo, totalTransicion, totalCatalisis };
}

/** Misma clasificación de enlace, pero para dos Elementos sueltos. */
export function calcularEnlaceResultanteElementos(a: Elemento, b: Elemento): ResultadoEnlace {
  const compuestoA: Compuesto = { id: a.id, nombre: a.nombre, componentes: [{ elemento_id: a.id, cantidad: 1 }] };
  const compuestoB: Compuesto = { id: b.id, nombre: b.nombre, componentes: [{ elemento_id: b.id, cantidad: 1 }] };
  return calcularEnlaceResultante(compuestoA, compuestoB, [a, b]);
}

// ─── Electromagnetismo Derivado ────────────────────────────────────────────
// Corriente Eléctrica: flujo de Voluntad a través de huecos de Percepción
// compatibles — reusa la Cancelación de Carga como medida de ese flujo.
// Campo Magnético: se induce cuando esa corriente se combina con la
// Cinética del Núcleo (si no hay corriente o no hay Cinética, no hay campo).
export function calcularElectromagnetismo(
  a: Compuesto,
  b: Compuesto,
  elementos: Elemento[],
): ResultadoElectromagnetismo {
  const cancelacion = calcularCancelacionCarga(a, b, elementos);
  const corriente = cancelacion.voluntadAaPercepcionB + cancelacion.voluntadBaPercepcionA;

  const perfilA = calcularPerfilAtomico(a, elementos);
  const perfilB = calcularPerfilAtomico(b, elementos);
  const cineticaTotal = (perfilA.nucleo.Cinética ?? 0) + (perfilB.nucleo.Cinética ?? 0);

  return {
    corriente,
    generaCampoMagnetico: corriente > 0 && cineticaTotal > 0,
    cineticaTotal,
  };
}

/** Mismo cálculo de electromagnetismo, pero para dos Elementos sueltos. */
export function calcularElectromagnetismoElementos(
  a: Elemento,
  b: Elemento,
): ResultadoElectromagnetismo {
  const compuestoA: Compuesto = { id: a.id, nombre: a.nombre, componentes: [{ elemento_id: a.id, cantidad: 1 }] };
  const compuestoB: Compuesto = { id: b.id, nombre: b.nombre, componentes: [{ elemento_id: b.id, cantidad: 1 }] };
  return calcularElectromagnetismo(compuestoA, compuestoB, [a, b]);
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

// ─── Descripción auto-generada de un Elemento ──────────────────────────────
// Lee directamente familia + capas + es_noble y arma un texto en lenguaje
// natural — no hay campo manual que mantener, se recalcula solo si se
// editan las capas. Misma idea que la afinidad: sale de la estructura
// real, no de una regla aparte.
export interface DescripcionElemento {
  /** Frase corta tipo "rol" (para badges/subtítulos). */
  rol: string;
  /** Párrafo explicando qué hace y para qué sirve. */
  texto: string;
}

/** Partícula(s) con mayor cantidad total sumando las 3 capas de un elemento. */
export function calcularParticulaDominante(
  elemento: Pick<Elemento, "nucleo" | "media" | "externa">,
): { particula: ParticleType; cantidad: number }[] {
  const total: ParticleMap = {};
  for (const layer of LAYERS) {
    for (const [tipo, cantidad] of Object.entries(elemento[layer] ?? {})) {
      if (!cantidad) continue;
      const k = tipo as ParticleType;
      total[k] = (total[k] ?? 0) + cantidad;
    }
  }
  const entradas = Object.entries(total) as [ParticleType, number][];
  if (entradas.length === 0) return [];
  const max = Math.max(...entradas.map(([, c]) => c));
  return entradas
    .filter(([, c]) => c === max)
    .map(([particula, cantidad]) => ({ particula, cantidad }));
}

export function generarDescripcionElemento(elemento: Elemento): DescripcionElemento {
  const perfil: PerfilAtomico = {
    nucleo: elemento.nucleo ?? {},
    media: elemento.media ?? {},
    externa: elemento.externa ?? {},
    capacidadExternaTotal: capacidadExterna(elemento.numero_atomico),
  };
  const balance = calcularBalancePorCapa(perfil);
  const balanceExterna = balance.find((b) => b.layer === "externa")!;
  const dominantes = calcularParticulaDominante(elemento);
  const nombreDominante =
    dominantes.length === 0
      ? null
      : dominantes.length === 1
        ? dominantes[0].particula
        : dominantes.map((d) => d.particula).join("/");

  // Rol corto, por familia + si está completo.
  const completo = balanceExterna.balance === 0;
  const rolFamilia: Record<ElementFamily, string> = {
    Sensibles: "sensible a estímulos externos",
    Nobles: "estable e inerte",
    "Base Terrosa": "base estructural, poco reactiva",
    Metal: "conductor y estructural, se alea con facilidad",
    Mineral: "denso y resistente, base de estructuras rígidas",
    "Gas/Fluido": "liviano y disperso, reactivo ante impulsos",
    Energético: "acumula o propaga energía activamente",
  };
  const rol = elemento.es_noble
    ? "Noble — inerte y estable"
    : `${elemento.familia} — ${rolFamilia[elemento.familia]}`;

  // Párrafo largo, combinando familia + capa externa + dominante.
  const partesTexto: string[] = [];

  if (elemento.es_noble) {
    partesTexto.push(
      `Elemento Noble: su capa externa está completa (${balanceExterna.total}/${balanceExterna.capacidad}), por lo que es raro y resistente a interferencia — no necesita combinarse con otros para estabilizarse.`,
    );
  } else if (completo) {
    partesTexto.push(
      `Su capa externa está completa (${balanceExterna.total}/${balanceExterna.capacidad}) pero no es Noble — estable por sí solo, aunque puede seguir participando en compuestos.`,
    );
  } else if (balanceExterna.balance < 0) {
    partesTexto.push(
      `Capa externa incompleta (${balanceExterna.total}/${balanceExterna.capacidad}): le faltan ${-balanceExterna.balance} partículas para estabilizarse — tiende a combinarse con elementos que se las aporten.`,
    );
  } else {
    partesTexto.push(
      `Capa externa sobrecargada (${balanceExterna.total}/${balanceExterna.capacidad}): tiene partículas de sobra — útil para completar compuestos con déficit en esa capa.`,
    );
  }

  if (nombreDominante) {
    partesTexto.push(
      `Predominan las partículas de ${nombreDominante}, lo que marca su especialidad dentro de la familia ${elemento.familia}.`,
    );
  }

  return { rol, texto: partesTexto.join(" ") };
}

// ─── Afinidad entre dos Elementos sueltos ──────────────────────────────────
// Misma lógica que calcularAfinidad para Compuestos, pero comparando
// directamente las capas de dos elementos — útil antes de armar un
// compuesto, para saber qué pareja de elementos tiene sentido combinar.
export function calcularAfinidadElementos(
  a: Elemento,
  b: Elemento,
): ResultadoAfinidad {
  const compuestoA: Compuesto = {
    id: a.id,
    nombre: a.nombre,
    componentes: [{ elemento_id: a.id, cantidad: 1 }],
  };
  const compuestoB: Compuesto = {
    id: b.id,
    nombre: b.nombre,
    componentes: [{ elemento_id: b.id, cantidad: 1 }],
  };
  return calcularAfinidad(compuestoA, compuestoB, [a, b]);
}

/**
 * Ordena una lista de elementos por afinidad descendente respecto de uno
 * de referencia — misma idea que ordenarPorAfinidad pero para Elementos.
 */
export function ordenarElementosPorAfinidad(
  referencia: Elemento,
  candidatos: Elemento[],
): { elemento: Elemento; afinidad: ResultadoAfinidad }[] {
  const orden: Record<string, number> = { complementa: 0, estable: 1, compite: 2, saturado: 3 };
  return candidatos
    .filter((e) => e.id !== referencia.id)
    .map((e) => ({ elemento: e, afinidad: calcularAfinidadElementos(referencia, e) }))
    .sort((x, y) => orden[x.afinidad.tipo] - orden[y.afinidad.tipo]);
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

// ─── Catalizadores: reducen déficit sin sumar a las capas ─────────────────
// Un elemento marcado es_catalizador aporta "presencia" que reduce cuánta
// energía hace falta para estabilizar un compuesto, pero — a diferencia de
// un componente normal — sus partículas NO se suman al perfil atómico de
// las capas y no se "consume" en la mezcla (no cuenta para estequiometría
// ni para peso molecular). Efecto: cada catalizador presente reduce el
// déficit total en una cantidad fija (su propio total de partículas, como
// medida de "cuánta energía de activación ahorra").
const REDUCCION_POR_CATALIZADOR = 1;

/** Total de déficit de un perfil, antes de aplicar catalizadores. */
function deficitTotalDePerfil(perfil: PerfilAtomico): number {
  return calcularBalancePorCapa(perfil)
    .filter((b) => b.balance < 0)
    .reduce((s, b) => s + -b.balance, 0);
}

/**
 * Déficit total de un compuesto ya con el efecto de catalizadores
 * aplicado: por cada catalizador entre los componentes (sin importar su
 * cantidad — no se "consume", solo tiene que estar presente), se resta
 * REDUCCION_POR_CATALIZADOR del déficit total, sin bajar de 0.
 */
export function calcularDeficitConCatalizadores(
  compuesto: Compuesto,
  elementos: Elemento[],
): { deficitBase: number; deficitFinal: number; catalizadoresActivos: Elemento[] } {
  const catalizadoresActivos = (compuesto.componentes ?? [])
    .map((c) => elementos.find((e) => e.id === c.elemento_id))
    .filter((e): e is Elemento => !!e && !!e.es_catalizador);

  // Perfil sin contar a los catalizadores (sus partículas no entran a las capas).
  const compuestoSinCatalizadores: Compuesto = {
    ...compuesto,
    componentes: (compuesto.componentes ?? []).filter((c) => {
      const el = elementos.find((e) => e.id === c.elemento_id);
      return !el?.es_catalizador;
    }),
  };
  const perfil = calcularPerfilAtomico(compuestoSinCatalizadores, elementos);
  const deficitBase = deficitTotalDePerfil(perfil);
  const deficitFinal = Math.max(
    0,
    deficitBase - catalizadoresActivos.length * REDUCCION_POR_CATALIZADOR,
  );

  return { deficitBase, deficitFinal, catalizadoresActivos };
}

// ─── Reactividad ("energía de activación") ─────────────────────────────────
// Cuanto más déficit total (sumando las 3 capas), menos energía hace falta
// para que el compuesto reaccione — es más inestable/reactivo. Un compuesto
// con déficit 0 (o negativo, saturado) es inerte. Los catalizadores del
// propio compuesto ya reducen el déficit antes de clasificar el nivel.
export function calcularReactividad(
  compuesto: Compuesto,
  elementos: Elemento[],
): ResultadoReactividad {
  // Capacidad total real del compuesto: nucleo+media fijos por elemento
  // presente, más la suma de techos de externa (armónico según Z) — no es
  // una constante global porque externa varía según qué elementos entran.
  const perfil = calcularPerfilAtomico(compuesto, elementos);
  const numElementos = (compuesto.componentes ?? []).reduce(
    (acc, c) => acc + Math.max(1, c.cantidad ?? 1),
    0,
  );
  const capacidadTotal =
    numElementos * (CAPACIDAD_CAPA_FIJA.nucleo + CAPACIDAD_CAPA_FIJA.media) +
    perfil.capacidadExternaTotal;
  const { deficitFinal } = calcularDeficitConCatalizadores(compuesto, elementos);

  const proporcion = capacidadTotal > 0 ? deficitFinal / capacidadTotal : 0;
  let nivel: NivelReactividad;
  if (deficitFinal === 0) nivel = "inerte";
  else if (proporcion <= 0.25) nivel = "moderado";
  else if (proporcion <= 0.6) nivel = "inestable";
  else nivel = "muy_inestable";

  return { deficitTotal: deficitFinal, capacidadTotal, nivel };
}

/** Misma clasificación de reactividad, pero para un Elemento suelto. */
export function calcularReactividadElemento(elemento: Elemento): ResultadoReactividad {
  const compuestoTemporal: Compuesto = {
    id: elemento.id,
    nombre: elemento.nombre,
    componentes: [{ elemento_id: elemento.id, cantidad: 1 }],
  };
  return calcularReactividad(compuestoTemporal, [elemento]);
}

// ─── Peso molecular ─────────────────────────────────────────────────────────
// Proxy simple: suma de TODAS las partículas de todos los componentes
// (multiplicadas por su cantidad), sin importar de qué capa vienen. Los
// catalizadores no suman peso: no forman parte de la estructura resultante.
export function calcularPeso(
  compuesto: Compuesto,
  elementos: Elemento[],
): ResultadoPeso {
  let pesoTotal = 0;
  for (const componente of compuesto.componentes ?? []) {
    const elemento = elementos.find((e) => e.id === componente.elemento_id);
    if (!elemento || elemento.es_catalizador) continue;
    const veces = Math.max(1, componente.cantidad ?? 1);
    const totalElemento =
      Object.values(elemento.nucleo ?? {}).reduce((a, b) => a + (b ?? 0), 0) +
      Object.values(elemento.media ?? {}).reduce((a, b) => a + (b ?? 0), 0) +
      Object.values(elemento.externa ?? {}).reduce((a, b) => a + (b ?? 0), 0);
    pesoTotal += totalElemento * veces;
  }

  const categoria: ResultadoPeso["categoria"] =
    pesoTotal <= 6 ? "liviano" : pesoTotal <= 14 ? "medio" : "pesado";

  return { pesoTotal, categoria };
}

// ─── Estequiometría exacta ──────────────────────────────────────────────────
// Busca el múltiplo entero mínimo de la mezcla completa (multiplicar TODAS
// las cantidades por el mismo factor k) tal que las 3 capas queden
// exactamente en 0 — equivalente a balancear 2H₂ + O₂ → 2H₂O escalando la
// ecuación entera. Si con ningún factor entero razonable se llega a 0 exacto
// (por ej. porque sobra un tipo de partícula que ningún elemento "consume"),
// no hay balance posible con esta mezcla y se devuelve balanceado: false.
export function calcularEstequiometriaExacta(
  compuesto: Compuesto,
  elementos: Elemento[],
  maxFactor = 12,
): ResultadoEstequiometria {
  const componentesBase = (compuesto.componentes ?? []).filter((c) => {
    const el = elementos.find((e) => e.id === c.elemento_id);
    return !el?.es_catalizador; // catalizadores no entran en la proporción
  });

  if (componentesBase.length === 0) {
    return { balanceado: false, componentes: [], factor: 0 };
  }

  for (let k = 1; k <= maxFactor; k++) {
    const escalados = componentesBase.map((c) => ({
      elemento_id: c.elemento_id,
      cantidad: c.cantidad * k,
    }));
    const compuestoEscalado: Compuesto = { ...compuesto, componentes: escalados };
    const perfil = calcularPerfilAtomico(compuestoEscalado, elementos);
    const balance = calcularBalancePorCapa(perfil);
    const exacto = balance.every((b) => b.balance === 0);
    if (exacto) {
      return { balanceado: true, componentes: escalados, factor: k };
    }
  }

  return { balanceado: false, componentes: [], factor: 0 };
}
