// ─────────────────────────────────────────────────────────────────────────────
// type.ts
// ─────────────────────────────────────────────────────────────────────────────
// Incluye parseSnippetRaw (antes en parseSnippetRaw.ts) al final del archivo.
// Ya no es necesario importar desde "./parseSnippetRaw" — importar desde "./type".

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de listas / capítulos
// ─────────────────────────────────────────────────────────────────────────────

export interface CapituloLista {
  id: string;
  orden: number;
  fecha_publicacion: string;
  titulo_capitulo?: string;
}

export interface CapituloScrollItem {
  id: string;
  orden: number;
  titulo_capitulo: string;
  /**
   * Opcional a propósito: el fetch de índice (todos los capítulos del
   * libro) YA NO trae `contenido` — solo metadata. El texto real vive en
   * `useLectorStore.contenidoPorCapId[cap.id]`, cargado bajo demanda por
   * `useContenidoCapitulo`. Este campo puede seguir presente en objetos
   * armados a mano (ej. tests, o el editor que sí carga todo junto), pero
   * el lector no debe depender de que esté seteado acá.
   */
  contenido?: string;
  fecha_publicacion: string;
  libros?: { titulo?: string };
  personajes_ids?: string[];
  reinos_ids?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Árbol de archivos
// ─────────────────────────────────────────────────────────────────────────────

export interface FileEntry {
  name: string;
  url: string;
  type: "image";
}
export interface FolderEntry {
  name: string;
  type: "folder";
  children: TreeNode[];
}
export type TreeNode = FileEntry | FolderEntry;

// ─────────────────────────────────────────────────────────────────────────────
// Segmentos de contenido
// ─────────────────────────────────────────────────────────────────────────────

export type Segment =
  | { type: "text"; value: string }
  | { type: "cita"; content: string }
  | { type: "epigrafe"; texto: string; atribucion: string }
  | { type: "img"; url: string; caption?: string }
  | { type: "float"; word: string; url: string; caption?: string }
  | { type: "sound"; url: string; volume: number }
  | { type: "dialogo"; personajeId: string; texto: string }
  | {
      type: "drop";
      word: string;
      entidadTipo: "item" | "criatura" | "personaje";
      entidadId: string;
      entidadNombre: string;
    }
  | { type: "choice"; label: string; target: string }
  | {
      type: "use";
      word: string;
      itemId: string;
      targetSuccess: string;
      targetFail?: string;
    }
  | { type: "section"; id: string; label?: string }
  | {
      type: "condicion";
      /** "item" = ¿el lector tiene este ítem? (antes "gate").
       *  "flag" = ¿el flag guardado === valorEsperado? (antes "flag-if"). */
      tipo: "item" | "flag";
      /** itemId (tipo "item") o flagId (tipo "flag"). */
      clave: string;
      /** Solo para tipo "flag": valor esperado contra el que se compara. */
      valorEsperado?: string;
      /** Segmentos de la rama "sí" (tiene el ítem / flag coincide). */
      siSegs: Segment[];
      /** id de sección destino si la rama "sí" — opcional. Si está
       *  presente, el lector navega a esa sección en vez de (o después de)
       *  renderizar siSegs inline. Mismo formato de sufijo "-> id" que usa
       *  el editor. */
      siTarget?: string;
      /** Segmentos de la rama "no" (no tiene el ítem / flag no coincide,
       *  incluye "nunca se seteó" para el caso flag). */
      noSegs: Segment[];
      /** id de sección destino si la rama "no" — opcional. */
      noTarget?: string;
    }
  | {
      type: "flag-set";
      flagId: string;
      /** Valor a guardar. Booleano "true"/"false" o texto libre (ej: "hostil"). */
      valor: string;
    };

export type SectionMap = Record<string, Segment[]>;

// ─────────────────────────────────────────────────────────────────────────────
// parseSections
// ─────────────────────────────────────────────────────────────────────────────

export function parseSections(segs: Segment[]): SectionMap {
  const map: SectionMap = { "": [] };
  let current = "";
  for (const seg of segs) {
    if (seg.type === "section") {
      current = seg.id;
      if (!map[current]) map[current] = [];
    } else {
      map[current].push(seg);
    }
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// extractCondicionBlocks — pre-extrae bloques [[condicion|...]] multilinea
// (fusión de gate + flag-if). También reconoce, para retrocompatibilidad
// con contenido guardado antes de la fusión, los formatos legacy
// [[gate|itemId|...]] y [[flag|if|flagId|valorEsperado|...]].
// ─────────────────────────────────────────────────────────────────────────────
//
// Formato nuevo:
//   [[condicion|item|itemId||
//   Texto si TIENE el ítem. Puede tener **markdown**, [[choice|...]] etc.
//   -> seccion-si (opcional)
//   ===
//   Texto si NO tiene el ítem.
//   -> seccion-no (opcional)
//   ]]
//
//   [[condicion|flag|flagId|valorEsperado|
//   Texto si el flag guardado === valorEsperado.
//   ===
//   Texto si NO coincide (incluye "nunca se seteó").
//   ]]

// Misma regex que TARGET_LINE (definida en CondicionNode.tsx, usada por el
// parser del editor) — debe mantenerse idéntica, porque acá parseamos el
// mismo formato de sufijo "-> id" directamente desde el markdown crudo.
const CONDICION_TARGET_LINE = /(?:^|\n)\s*->\s*([a-z0-9-]+)\s*$/i;

function splitCondicionTargetSuffix(branchText: string): {
  text: string;
  target?: string;
} {
  const m = CONDICION_TARGET_LINE.exec(branchText);
  if (!m) return { text: branchText.trim() };
  return { text: branchText.slice(0, m.index).trim(), target: m[1].trim() };
}

interface CondicionBlock {
  tipo: "item" | "flag";
  clave: string;
  valorEsperado?: string;
  siTexto: string;
  noTexto: string;
  siTarget?: string;
  noTarget?: string;
}

function splitCondicionBranches(contenido: string): {
  si: { text: string; target?: string };
  no: { text: string; target?: string };
} {
  const separatorIdx = contenido.indexOf("===");
  const siRaw = separatorIdx >= 0 ? contenido.slice(0, separatorIdx) : contenido;
  const noRaw = separatorIdx >= 0 ? contenido.slice(separatorIdx + 3) : "";
  return {
    si: splitCondicionTargetSuffix(siRaw),
    no: splitCondicionTargetSuffix(noRaw),
  };
}

function extractCondicionBlocks(texto: string): {
  resultado: string;
  condiciones: Map<string, CondicionBlock>;
} {
  const condiciones = new Map<string, CondicionBlock>();
  let counter = 0;

  const condicionRegex =
    /\[\[condicion\|(item|flag)\|([^\|]+)\|([^\|]*)\|([\s\S]+?)\]\]/g;
  let resultado = texto.replace(
    condicionRegex,
    (_, tipo, clave, valorEsperado, contenido) => {
      const { si, no } = splitCondicionBranches(contenido);
      const placeholder = `\x00CONDICION_${counter}\x00`;
      condiciones.set(placeholder, {
        tipo: tipo as "item" | "flag",
        clave: clave.trim(),
        valorEsperado: tipo === "flag" ? valorEsperado.trim() : undefined,
        siTexto: si.text,
        noTexto: no.text,
        siTarget: si.target,
        noTarget: no.target,
      });
      counter++;
      return placeholder;
    },
  );

  // Legacy: [[gate|itemId|...===...]]
  const gateRegex = /\[\[gate\|([^\|]+)\|([\s\S]+?)\]\]/g;
  resultado = resultado.replace(gateRegex, (_, itemId, contenido) => {
    const { si, no } = splitCondicionBranches(contenido);
    const placeholder = `\x00CONDICION_${counter}\x00`;
    condiciones.set(placeholder, {
      tipo: "item",
      clave: itemId.trim(),
      siTexto: si.text,
      noTexto: no.text,
      siTarget: si.target,
      noTarget: no.target,
    });
    counter++;
    return placeholder;
  });

  // Legacy: [[flag|if|flagId|valorEsperado|...===...]]
  // "if" en el separador de kind|op distingue este bloque multilinea de
  // [[flag|set|...]], que es single-line y no debe caer en esta regex.
  const flagIfRegex = /\[\[flag\|if\|([^\|]+)\|([^\|]*)\|([\s\S]+?)\]\]/g;
  resultado = resultado.replace(
    flagIfRegex,
    (_, flagId, valorEsperado, contenido) => {
      const { si, no } = splitCondicionBranches(contenido);
      const placeholder = `\x00CONDICION_${counter}\x00`;
      condiciones.set(placeholder, {
        tipo: "flag",
        clave: flagId.trim(),
        valorEsperado: valorEsperado.trim(),
        siTexto: si.text,
        noTexto: no.text,
        siTarget: si.target,
        noTarget: no.target,
      });
      counter++;
      return placeholder;
    },
  );

  return { resultado, condiciones };
}

// ─────────────────────────────────────────────────────────────────────────────
// parseContenido
// ─────────────────────────────────────────────────────────────────────────────

export function parseContenido(texto: string): Segment[] {
  const { resultado, condiciones } = extractCondicionBlocks(texto);

  const regex = /\[\[(\w+)\|([\s\S]+?)\]\]|\x00CONDICION_\d+\x00/g;
  const segs: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(resultado)) !== null) {
    if (match.index > lastIndex) {
      segs.push({
        type: "text",
        value: resultado.slice(lastIndex, match.index),
      });
    }

    const raw = match[0];

    if (raw.startsWith("\x00CONDICION_")) {
      const condicion = condiciones.get(raw);
      if (condicion) {
        segs.push({
          type: "condicion",
          tipo: condicion.tipo,
          clave: condicion.clave,
          valorEsperado: condicion.valorEsperado,
          siSegs: parseContenido(condicion.siTexto),
          noSegs: parseContenido(condicion.noTexto),
          siTarget: condicion.siTarget,
          noTarget: condicion.noTarget,
        });
      }
      lastIndex = match.index + raw.length;
      continue;
    }

    const [, kind, rest] = match;
    const parts = rest.split("|").map((p: string) => p.trim());

    if (kind === "cita") segs.push({ type: "cita", content: parts[0] });
    else if (kind === "epigrafe")
      segs.push({
        type: "epigrafe",
        texto: parts[0] ?? "",
        atribucion: parts[1] ?? "",
      });
    else if (kind === "img")
      segs.push({ type: "img", url: parts[0], caption: parts[1] });
    else if (kind === "float")
      segs.push({
        type: "float",
        word: parts[0],
        url: parts[1],
        caption: parts[2],
      });
    else if (kind === "sound")
      segs.push({
        type: "sound",
        url: parts[0],
        volume: parseFloat(parts[1] ?? "0.5"),
      });
    else if (kind === "dialogo")
      // parts[0] = personaje_id, resto = texto del diálogo. El texto se
      // reúne con join("|") en vez de tomar solo parts[1] porque puede
      // contener "|" real (diálogo con guiones, citas, etc.) — solo el
      // primer "|" (id | texto) es estructural.
      segs.push({
        type: "dialogo",
        personajeId: parts[0] ?? "",
        texto: parts.slice(1).join("|"),
      });
    else if (kind === "drop")
      segs.push({
        type: "drop",
        word: parts[0] ?? "",
        entidadTipo: (parts[1] ?? "personaje") as
          | "item"
          | "criatura"
          | "personaje",
        entidadId: parts[2] ?? "",
        entidadNombre: parts[3] ?? parts[0] ?? "",
      });
    else if (kind === "choice")
      segs.push({ type: "choice", label: parts[0], target: parts[1] });
    else if (kind === "section")
      segs.push({ type: "section", id: parts[0], label: parts[1] });
    else if (kind === "flag" && parts[0] === "set")
      segs.push({
        type: "flag-set",
        flagId: parts[1] ?? "",
        valor: parts[2] ?? "",
      });
    else if (kind === "use")
      segs.push({
        type: "use",
        word: parts[0],
        itemId: parts[1],
        targetSuccess: parts[2],
        targetFail: parts[3],
      });
    else segs.push({ type: "text", value: raw });

    lastIndex = match.index + raw.length;
  }

  if (lastIndex < resultado.length) {
    segs.push({ type: "text", value: resultado.slice(lastIndex) });
  }

  return segs;
}

// ─────────────────────────────────────────────────────────────────────────────
// parseSnippetRaw  (antes en parseSnippetRaw.ts)
// ─────────────────────────────────────────────────────────────────────────────
// Extrae los valores iniciales de un snippet raw `[[kind|…]]`
// para pre-poblar los modales cuando el usuario hace clic en ✎.

export type ParsedSnippet =
  | { kind: "drop"; entidadId: string; entidadTipo: string; label: string }
  | { kind: "img"; url: string; alt: string; float: boolean }
  | { kind: "float"; url: string; alt: string; float: true }
  | { kind: "choice"; texto: string; target: string }
  | { kind: "dialogo"; personajeId: string; texto: string }
  | {
      kind: "use";
      itemId: string;
      label: string;
      sectionOk: string;
      sectionFail: string;
    }
  | {
      kind: "condicion";
      tipo: "item" | "flag";
      clave: string;
      valorEsperado?: string;
      siTexto: string;
      noTexto: string;
      siTarget?: string;
      noTarget?: string;
    }
  | { kind: "section"; id: string; label: string }
  | { kind: "sound"; src: string; label: string }
  | { kind: "epigrafe"; texto: string; atribucion: string }
  | { kind: "flag-set"; flagId: string; valor: string }
  | { kind: "unknown"; parts: string[] };

export function parseSnippetRaw(raw: string | undefined): ParsedSnippet | null {
  if (!raw) return null;

  const inner =
    raw.startsWith("[[") && raw.endsWith("]]") ? raw.slice(2, -2) : raw;

  const parts = inner.split("|").map((p) => p.trim());
  const kind = parts[0];

  switch (kind) {
    case "drop":
      // [[drop|palabra|tipo|id|nombre]]
      return {
        kind: "drop",
        label: parts[1] ?? "",
        entidadTipo: parts[2] ?? "",
        entidadId: parts[3] ?? "",
      };
    case "dialogo":
      // [[dialogo|personaje_id|texto]] — texto puede contener "|" real.
      return {
        kind: "dialogo",
        personajeId: parts[1] ?? "",
        texto: parts.slice(2).join("|"),
      };
    case "img":
      return {
        kind: "img",
        url: parts[1] ?? "",
        alt: parts[2] ?? "",
        float: false,
      };
    case "float":
      return {
        kind: "float",
        url: parts[1] ?? "",
        alt: parts[2] ?? "",
        float: true,
      };
    case "choice":
      // [[choice|Texto del botón|sectionId]]
      return { kind: "choice", texto: parts[1] ?? "", target: parts[2] ?? "" };
    case "use":
      // [[use|Palabra|itemId|sectionOk|sectionFail]]
      return {
        kind: "use",
        itemId: parts[2] ?? "",
        label: parts[1] ?? "",
        sectionOk: parts[3] ?? "",
        sectionFail: parts[4] ?? "",
      };
    case "condicion": {
      // El split naive por "|" no sirve acá: el cuerpo usa "===" como
      // separador entre ramas y puede contener texto libre. Re-derivamos
      // del raw completo, igual que condicionRawToPayload en CondicionNode.tsx.
      const cm =
        /^\[\[condicion\|(item|flag)\|([^\|]+)\|([^\|]*)\|([\s\S]*)\]\]$/.exec(
          raw,
        );
      if (!cm)
        return {
          kind: "condicion",
          tipo: "item",
          clave: "",
          siTexto: "",
          noTexto: "",
        };
      const tipo = cm[1] as "item" | "flag";
      const clave = cm[2].trim();
      const valorEsperado = cm[3].trim();
      const contenido = cm[4];
      const sepIdx = contenido.indexOf("===");
      const siRaw = sepIdx >= 0 ? contenido.slice(0, sepIdx) : contenido;
      const noRaw = sepIdx >= 0 ? contenido.slice(sepIdx + 3) : "";
      const targetLine = /(?:^|\n)\s*->\s*([a-z0-9-]+)\s*$/i;
      const splitTarget = (branch: string) => {
        const tm = targetLine.exec(branch);
        if (!tm) return { text: branch.trim(), target: undefined as string | undefined };
        return { text: branch.slice(0, tm.index).trim(), target: tm[1].trim() };
      };
      const si = splitTarget(siRaw);
      const no = splitTarget(noRaw);
      return {
        kind: "condicion",
        tipo,
        clave,
        valorEsperado: tipo === "flag" ? valorEsperado : undefined,
        siTexto: si.text,
        noTexto: no.text,
        siTarget: si.target,
        noTarget: no.target,
      };
    }
    // "gate" queda como retrocompatibilidad: contenido guardado antes de
    // la fusión que todavía no se migró a "condicion" al guardar de nuevo.
    case "gate": {
      const gm = /^\[\[gate\|([^\|]+)\|([\s\S]*)\]\]$/.exec(raw);
      if (!gm)
        return {
          kind: "condicion",
          tipo: "item",
          clave: "",
          siTexto: "",
          noTexto: "",
        };
      const clave = gm[1].trim();
      const contenido = gm[2];
      const sepIdx = contenido.indexOf("===");
      const tieneRaw = sepIdx >= 0 ? contenido.slice(0, sepIdx) : contenido;
      const noTieneRaw = sepIdx >= 0 ? contenido.slice(sepIdx + 3) : "";
      const targetLine = /(?:^|\n)\s*->\s*([a-z0-9-]+)\s*$/i;
      const splitTarget = (branch: string) => {
        const tm = targetLine.exec(branch);
        if (!tm) return { text: branch.trim(), target: undefined as string | undefined };
        return { text: branch.slice(0, tm.index).trim(), target: tm[1].trim() };
      };
      const tiene = splitTarget(tieneRaw);
      const noTiene = splitTarget(noTieneRaw);
      return {
        kind: "condicion",
        tipo: "item",
        clave,
        siTexto: tiene.text,
        noTexto: noTiene.text,
        siTarget: tiene.target,
        noTarget: noTiene.target,
      };
    }
    case "section":
      return { kind: "section", id: parts[1] ?? "", label: parts[2] ?? "" };
    case "epigrafe":
      // [[epigrafe|Texto|Atribución]] — atribución puede venir vacía
      return {
        kind: "epigrafe",
        texto: parts[1] ?? "",
        atribucion: parts[2] ?? "",
      };
    case "sound":
      return { kind: "sound", src: parts[1] ?? "", label: parts[2] ?? "" };
    case "flag": {
      // [[flag|set|flagId|valor]] — single-line, split naive alcanza.
      if (parts[1] === "set") {
        return {
          kind: "flag-set",
          flagId: parts[2] ?? "",
          valor: parts[3] ?? "",
        };
      }
      // Legacy: [[flag|if|flagId|valorEsperado|\nsiTexto\n===\nnoTexto\n]]
      // migra a "condicion" — el cuerpo puede tener "|" y "===" libres, así
      // que re-derivamos del raw completo en vez de confiar en el split naive.
      const fm =
        /^\[\[flag\|if\|([^\|]+)\|([^\|]*)\|([\s\S]*)\]\]$/.exec(raw);
      if (!fm)
        return {
          kind: "condicion",
          tipo: "flag",
          clave: "",
          valorEsperado: "",
          siTexto: "",
          noTexto: "",
        };
      const clave = fm[1].trim();
      const valorEsperado = fm[2].trim();
      const contenido = fm[3];
      const sepIdx = contenido.indexOf("===");
      const siRaw = sepIdx >= 0 ? contenido.slice(0, sepIdx) : contenido;
      const noRaw = sepIdx >= 0 ? contenido.slice(sepIdx + 3) : "";
      const targetLine = /(?:^|\n)\s*->\s*([a-z0-9-]+)\s*$/i;
      const splitTarget = (branch: string) => {
        const tm = targetLine.exec(branch);
        if (!tm)
          return { text: branch.trim(), target: undefined as string | undefined };
        return { text: branch.slice(0, tm.index).trim(), target: tm[1].trim() };
      };
      const si = splitTarget(siRaw);
      const no = splitTarget(noRaw);
      return {
        kind: "condicion",
        tipo: "flag",
        clave,
        valorEsperado,
        siTexto: si.text,
        noTexto: no.text,
        siTarget: si.target,
        noTarget: no.target,
      };
    }
    default:
      return { kind: "unknown", parts };
  }
}
