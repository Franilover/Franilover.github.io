import type { Seccion, IdiomaKey, LineaConTiempo } from "./types";

export function fmtTime(s: number): string {
  const m  = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${ss.toString().padStart(2, "0")}.${ms}`;
}

export function fmtTimeSeg(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parseTimeSeg(str: string): number | null {
  const parts = str.trim().split(":");
  if (parts.length === 2) {
    const m = parseInt(parts[0]);
    const s = parseFloat(parts[1]);
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s;
  }
  const plain = parseFloat(str);
  return isNaN(plain) ? null : plain;
}

export function buildLineas(secciones: Seccion[], idioma: IdiomaKey): LineaConTiempo[] {
  const getLetra = (s: Seccion): string =>
    (idioma === "es" ? s.letra_es : idioma === "en" ? s.letra_en : idioma === "jp" ? s.letra_jp : s.letra_romaji) || "";

  const lineas: LineaConTiempo[] = [];
  for (const sec of secciones) {
    const texto = getLetra(sec);
    if (!texto.trim()) continue;
    texto.split("\n").forEach((linea, idx) => {
      lineas.push({ seccionId: sec.id, lineaIdx: idx, texto: linea, tiempo: null });
    });
  }
  return lineas;
}

export function parseLrc(
  texto: string,
  secciones: Seccion[],
  idioma: IdiomaKey,
): Record<string, Record<number, number>> {
  const result: Record<string, Record<number, number>> = {};
  const lines = texto.split("\n");
  const timedLines: { tiempo: number; texto: string }[] = [];

  for (const line of lines) {
    const match = line.match(/^\[(\d+):(\d+\.?\d*)\](.*)$/);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseFloat(match[2]);
      timedLines.push({ tiempo: min * 60 + sec, texto: match[3].trim() });
    }
  }

  const getLetraLocal = (sec: Seccion): string =>
    (idioma === "es" ? sec.letra_es : idioma === "en" ? sec.letra_en : idioma === "jp" ? sec.letra_jp : sec.letra_romaji) || "";

  let lrcIdx = 0;
  for (const sec of secciones) {
    const letra = getLetraLocal(sec);
    if (!letra.trim()) continue;
    const lineas = letra.split("\n");
    for (let li = 0; li < lineas.length; li++) {
      const linea = lineas[li].trim();
      if (!linea) continue;
      if (lrcIdx < timedLines.length) {
        if (!result[sec.id]) result[sec.id] = {};
        result[sec.id][li] = Math.round(timedLines[lrcIdx].tiempo * 10) / 10;
        lrcIdx++;
      }
    }
  }
  return result;
}
