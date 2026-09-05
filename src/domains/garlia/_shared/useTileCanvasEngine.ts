"use client";

/**
 * useTileCanvasEngine
 * ────────────────────
 * Motor compartido de UnifiedTileCanvas: cámara (pan/zoom), composición de
 * tiles en OffscreenCanvas, conversión de coordenadas mundo↔pantalla, y el
 * render loop completo (tiles, grilla fantasma, áreas, vértices, dibujo en
 * curso, papelera flotante).
 *
 * Extraído tal cual de UnifiedTileCanvas (paso 0 del refactor) — sin cambiar
 * comportamiento. La idea es que tanto la vista pública (solo lectura) como
 * la vista de edición consuman este mismo motor en vez de duplicar la
 * matemática de cámara/coordenadas o el dibujo del canvas.
 *
 * Este hook NO agrega listeners de puntero — eso queda en cada consumidor
 * (TileCanvasView para pan/zoom/click, useTileCanvasEditing para gestos de
 * edición), que sí necesitan decidir cosas distintas según el modo.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";

import type { BaseArea, BaseMarker, BaseTile, WorldPoint } from "./UnifiedTileCanvas";

export interface TileCanvasEngineOptions<
  TTile extends BaseTile,
  TMarker extends BaseMarker,
> {
  tiles: TTile[];
  markers: TMarker[];
  hiddenMarkers: TMarker[];
  tileSize: number;
  editMode: boolean;
  fondoColor?: string | null;
  selectedMarkerId: string | null;
  areas: BaseArea[];
  selectedAreaId: string | null;
  drawTool: "circulo" | "rectangulo" | "poligono" | null;
  /** Puntos en curso del dibujo activo (círculo/rectángulo/polígono) — el
   * consumidor de edición los mantiene; acá solo se usan para previsualizar. */
  drawingPoints: WorldPoint[];
  /** Ref (no valor) — se lee fresco en cada frame del render loop, igual
   * que en el componente original, sin depender de que React re-dispare
   * el efecto del draw loop en cada movimiento de mouse durante el dibujo. */
  drawCursorRef: RefObject<WorldPoint | null>;
  /** Tile bajo el cursor (para resaltarlo y mostrar la papelera). Lo decide
   * el consumidor de edición vía pointermove. */
  hoverTile: TTile | null;
  /** Casilla fantasma bajo el cursor. Igual, lo decide el consumidor de edición. */
  ghostHover: { col: number; row: number } | null;
}

export function useTileCanvasEngine<
  TTile extends BaseTile,
  TMarker extends BaseMarker,
>(opts: TileCanvasEngineOptions<TTile, TMarker>) {
  const {
    tiles,
    markers,
    hiddenMarkers,
    tileSize,
    editMode,
    fondoColor,
    selectedMarkerId,
    areas,
    selectedAreaId,
    drawTool,
    drawingPoints,
    drawCursorRef,
    hoverTile,
    ghostHover,
  } = opts;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const compositeRef = useRef<OffscreenCanvas | null>(null);
  const compositeReadyRef = useRef(false);
  const [compositeReady, setCompositeReady] = useState(false);

  const camRef = useRef({ x: 0, y: 0, scale: 1 });
  // Factor backing-store/CSS del canvas, actualizado solo en resize — evita
  // leer el DOM (getBoundingClientRect, que fuerza reflow) en cada evento de
  // pointermove durante el pan, que es donde más se nota.
  const renderScaleRef = useRef(1);
  const animFrameRef = useRef<number>(0);
  const pulseRef = useRef(0);

  // ── Rendimiento: dirty flag + caché ───────────────────────────────────────
  const dirtyRef = useRef(true); // true = necesita redibujar
  const labelCacheRef = useRef<Map<string, number>>(new Map()); // id → textWidth
  const ghostGridRef = useRef<{
    gMinCol: number;
    gMinRow: number;
    gMaxCol: number;
    gMaxRow: number;
    tileSet: Set<string>;
  } | null>(null);
  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  const cssColorsRef = useRef({
    primary: "#6b4423",
    accent: "#c08040",
    bg: "#f0e6d0",
    fg: "#2a1304",
    labelBg: "#fdf6ee",
    labelText: "#2a1304",
    isDark: false,
  });

  // Refs "espejo" de los valores hover, para que el render loop los lea sin
  // tener que re-suscribirse (mismo patrón que el original).
  const hoverTileRef = useRef<TTile | null>(hoverTile);
  hoverTileRef.current = hoverTile;
  const ghostHoverRef = useRef<{ col: number; row: number } | null>(
    ghostHover,
  );
  ghostHoverRef.current = ghostHover;

  // Rect (en coords de pantalla) de la papelerita activa, para detectar el click
  const trashRectRef = useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
    tile: TTile;
  } | null>(null);

  // ── Identidad estable por CONTENIDO (no por referencia) ───────────────────
  // tiles/markers/hiddenMarkers llegan como arrays nuevos en cada render del
  // consumidor (ej. mapaGarlia.tsx arma `markers={[...visibleMarkers, ...]}`
  // inline, sin useMemo). Si algún efecto de acá abajo los usa tal cual como
  // dependencia, un simple re-render del padre (ej. al abrir el panel de un
  // reino) alcanza para "cambiar" la dependencia aunque el contenido sea
  // idéntico, reiniciando ese efecto de la nada. Estas claves de texto
  // representan el contenido real, así que solo cambian cuando los datos
  // efectivamente cambian — mismo patrón que ya se usaba para el efecto de
  // composición de tiles, ahora aplicado también al resto.
  const tilesKey = useMemo(
    () => tiles.map((t) => `${t.col}:${t.row}:${t.image_url}`).join("|"),
    [tiles],
  );
  const markersKey = useMemo(
    () => markers.map((m) => JSON.stringify(m)).join("|"),
    [markers],
  );
  const hiddenMarkersKey = useMemo(
    () => hiddenMarkers.map((m) => JSON.stringify(m)).join("|"),
    [hiddenMarkers],
  );

  // ── Dimensiones del canvas virtual ────────────────────────────────────────
  const minCol = tiles.length > 0 ? Math.min(...tiles.map((t) => t.col)) : 0;
  const minRow = tiles.length > 0 ? Math.min(...tiles.map((t) => t.row)) : 0;
  const totalCols =
    tiles.length > 0 ? Math.max(...tiles.map((t) => t.col)) - minCol + 1 : 1;
  const totalRows =
    tiles.length > 0 ? Math.max(...tiles.map((t) => t.row)) - minRow + 1 : 1;
  const totalW = totalCols * tileSize;
  const totalH = totalRows * tileSize;

  // ── Leer CSS vars para theming ────────────────────────────────────────────
  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      const get = (v: string) => s.getPropertyValue(v).trim();
      const bgMain = get("--bg-main") || "#f0e6d0";
      const wc = get("--white-custom") || "#fdf6ee";
      const fgColor = get("--foreground") || "#2a1304";
      const bgMenuColor = get("--bg-menu") || "#3d2010";
      const hexToLuma = (hex: string) => {
        const h = hex.replace("#", "");
        if (h.length < 6) return 0.5;
        const r = parseInt(h.slice(0, 2), 16) / 255;
        const g = parseInt(h.slice(2, 4), 16) / 255;
        const b = parseInt(h.slice(4, 6), 16) / 255;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const dark = hexToLuma(bgMain) < 0.35;
      cssColorsRef.current = {
        primary: get("--primary") || "#6b4423",
        accent: get("--accent") || "#c08040",
        bg: bgMain,
        fg: fgColor,
        labelBg: dark ? bgMenuColor : wc,
        labelText: fgColor,
        isDark: dark,
      };
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => obs.disconnect();
  }, []);

  // ── Componer tiles en OffscreenCanvas ─────────────────────────────────────
  useEffect(() => {
    compositeReadyRef.current = false;
    setCompositeReady(false);

    const tilesWithImage = tiles.filter((t) => t.image_url);
    if (tilesWithImage.length === 0) {
      compositeRef.current = null;
      compositeReadyRef.current = true;
      setCompositeReady(true);
      return;
    }

    const oc = new OffscreenCanvas(totalW, totalH);
    const octx = oc.getContext("2d")!;
    let loaded = 0;

    tilesWithImage.forEach((tile) => {
      const img = new window.Image();
      if (tile.image_url!.startsWith("http")) img.crossOrigin = "anonymous";
      img.src = tile.image_url!;
      const drawX = (tile.col - minCol) * tileSize;
      const drawY = (tile.row - minRow) * tileSize;
      const onDone = () => {
        loaded++;
        if (loaded === tilesWithImage.length) {
          compositeRef.current = oc;
          compositeReadyRef.current = true;
          setCompositeReady(true);
          markDirty();
        }
      };
      img.onload = () => {
        octx.drawImage(img, drawX, drawY, tileSize, tileSize);
        onDone();
      };
      img.onerror = onDone;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tilesKey, tileSize, totalW, totalH]);

  // ── Centrar al cargar ─────────────────────────────────────────────────────
  const hasCenteredRef = useRef(false);
  const centerImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale =
      Math.min(canvas.width / totalW, canvas.height / totalH) * 0.95;
    camRef.current = {
      x: (canvas.width - totalW * scale) / 2,
      y: (canvas.height - totalH * scale) / 2,
      scale,
    };
    markDirty();
  }, [totalW, totalH, markDirty]);

  // Centrar cuando compositeReady cambia a true (primera carga)
  useEffect(() => {
    if (compositeReady) {
      centerImage();
      hasCenteredRef.current = true;
    }
  }, [compositeReady, centerImage]);

  // Recentrar si los tiles llegan tarde y cambian las dimensiones del mapa
  const prevTotalWRef = useRef(totalW);
  const prevTotalHRef = useRef(totalH);
  useEffect(() => {
    if (
      hasCenteredRef.current &&
      (totalW !== prevTotalWRef.current || totalH !== prevTotalHRef.current)
    ) {
      centerImage();
    }
    prevTotalWRef.current = totalW;
    prevTotalHRef.current = totalH;
  }, [totalW, totalH, centerImage]);

  // ── Resize ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Mismo criterio que en CanvasMap: capamos la resolución interna para que
    // ventanas grandes de escritorio no multipliquen el costo de cada frame.
    const MAX_DIM = 1400;
    const capDims = (w: number, h: number) => {
      const largest = Math.max(w, h);
      if (largest <= MAX_DIM) return { w, h };
      const f = MAX_DIM / largest;
      return { w: Math.round(w * f), h: Math.round(h * f) };
    };

    const apply = () => {
      const hadValidSize = canvas.width > 0 && canvas.height > 0;
      const { w, h } = capDims(container.clientWidth, container.clientHeight);
      canvas.width = w;
      canvas.height = h;
      renderScaleRef.current = container.clientWidth
        ? w / container.clientWidth
        : 1;
      // Solo recentramos si todavía no nos centramos nunca, o si el canvas
      // pasó de no tener tamaño real (0) a tenerlo (primer layout válido).
      // Un resize del contenedor DESPUÉS de eso (ej. al abrir el panel
      // lateral de un reino, que angosta el mapa) NO debe resetear el
      // zoom/pan que el usuario ya tiene — antes centerImage() se llamaba
      // siempre acá y cualquier resize (incluido el de abrir el panel)
      // recentraba el mapa de golpe.
      if (!hasCenteredRef.current || !hadValidSize) {
        centerImage();
      }
    };
    apply();

    // Si al montar el contenedor mide 0 (ej. al recargar la página directo
    // en esta sección por el estado persistido de navegación, cuando el
    // layout del sidebar/fuentes todavía no terminó de estabilizarse), el
    // ResizeObserver puede no volver a disparar nunca — el contenedor ya
    // no "cambia" de tamaño, simplemente nació en 0. Reintentamos unos
    // frames hasta que mida algo real.
    let raf = 0;
    let attempts = 0;
    const retryIfZero = () => {
      if (container.clientHeight > 0 && container.clientWidth > 0) return;
      if (++attempts > 30) return; // ~0.5s a 60fps, evita loop infinito
      apply();
      raf = requestAnimationFrame(retryIfZero);
    };
    raf = requestAnimationFrame(retryIfZero);

    const ro = new ResizeObserver(apply);
    ro.observe(container);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [centerImage]);

  // Lee el factor cacheado — no mide el DOM en el hot path de eventos.
  const cssToCanvasScale = useCallback(() => renderScaleRef.current, []);

  // ── Helpers de coordenadas ────────────────────────────────────────────────
  const getMarkerScreenPos = useCallback(
    (m: TMarker, cx: number, cy: number, scale: number) => {
      let mx: number, my: number;
      if (m.tile_col != null && m.tile_row != null) {
        const tOx = (m.tile_col - minCol) * tileSize * scale;
        const tOy = (m.tile_row - minRow) * tileSize * scale;
        mx = cx + tOx + ((m.coord_x ?? 50) / 100) * tileSize * scale;
        my = cy + tOy + ((m.coord_y ?? 50) / 100) * tileSize * scale;
      } else {
        mx = cx + ((m.coord_x ?? 50) / 100) * (totalW * scale);
        my = cy + ((m.coord_y ?? 50) / 100) * (totalH * scale);
      }
      return { mx, my };
    },
    [minCol, minRow, tileSize, totalW, totalH],
  );

  // Punto mundo → coords de pantalla dentro del transform (relativo a cx,cy=0,0;
  // el caller suma cx/cy si necesita coords absolutas de canvas).
  const worldToLocal = useCallback(
    (p: WorldPoint, scale: number) => {
      const tOx = (p.col - minCol) * tileSize * scale;
      const tOy = (p.row - minRow) * tileSize * scale;
      return {
        lx: tOx + (p.x / 100) * tileSize * scale,
        ly: tOy + (p.y / 100) * tileSize * scale,
      };
    },
    [minCol, minRow, tileSize],
  );

  const canvasToTileInfo = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const s = cssToCanvasScale();
      const px = (clientX - rect.left) * s;
      const py = (clientY - rect.top) * s;
      const { x: cx, y: cy, scale } = camRef.current;
      const canvasX = (px - cx) / scale;
      const canvasY = (py - cy) / scale;
      // Math.floor no funciona bien con negativos en JS (-0.1 → -1, no 0)
      // usamos Math.floor sobre el offset desde minCol/minRow
      const clickedCol = minCol + Math.floor(canvasX / tileSize);
      const clickedRow = minRow + Math.floor(canvasY / tileSize);
      const modX = ((canvasX % tileSize) + tileSize) % tileSize;
      const modY = ((canvasY % tileSize) + tileSize) % tileSize;
      const localX = Math.max(
        0,
        Math.min(100, Math.round((modX / tileSize) * 100)),
      );
      const localY = Math.max(
        0,
        Math.min(100, Math.round((modY / tileSize) * 100)),
      );
      return {
        x: localX,
        y: localY,
        tile_col: clickedCol,
        tile_row: clickedRow,
        px,
        py,
      };
    },
    [cssToCanvasScale, minCol, minRow, tileSize],
  );

  const clientToWorldPoint = useCallback(
    (clientX: number, clientY: number): WorldPoint | null => {
      const info = canvasToTileInfo(clientX, clientY);
      if (!info) return null;
      return { col: info.tile_col, row: info.tile_row, x: info.x, y: info.y };
    },
    [canvasToTileInfo],
  );

  const findTileAt = useCallback(
    (col: number, row: number) =>
      tiles.find((t) => t.col === col && t.row === row) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tilesKey],
  );

  // Convierte un WorldPoint a "unidades de tile" continuas (col + x/100),
  // útil para hit-testing sin depender de escala de pantalla.
  const toTileUnits = useCallback(
    (p: WorldPoint) => ({
      ux: p.col + p.x / 100,
      uy: p.row + p.y / 100,
    }),
    [],
  );

  // Inversa de toTileUnits — reconstruye col/row/x/y a partir de unidades
  // continuas. Usada al trasladar un área completa, donde el delta puede
  // cruzar el borde de una celda de tile.
  const fromTileUnits = useCallback((ux: number, uy: number): WorldPoint => {
    const col = Math.floor(ux);
    const row = Math.floor(uy);
    return { col, row, x: (ux - col) * 100, y: (uy - row) * 100 };
  }, []);

  // Mismo umbral que el draw loop (ver CIUDAD_ZOOM_CERCANO_TS reusada más
  // abajo): una ciudad que no se está dibujando (de lejos, fuera de
  // editMode) no debe registrar hits — sin esto, un click en esa zona
  // "atravesaría" al reino de abajo pero en realidad activaría un área
  // invisible.
  const CIUDAD_ZOOM_CERCANO_TS = 420;
  const isCiudadVisibleParaHit = useCallback(
    (area: BaseArea): boolean => {
      if (!area.ciudad_id) return true; // no es ciudad, no aplica este filtro
      const ts = tileSize * camRef.current.scale;
      if (ts > CIUDAD_ZOOM_CERCANO_TS) return true; // zoom cercano: visible y clickeable
      return editMode; // lejos: solo clickeable en editMode (borde tenue)
    },
    [tileSize, editMode],
  );

  const isPointInArea = useCallback(
    (wp: WorldPoint, area: BaseArea): boolean => {
      if (!isCiudadVisibleParaHit(area)) return false;
      const p = toTileUnits(wp);
      if (area.tipo === "circulo" && area.puntos.length >= 2) {
        const c = toTileUnits(area.puntos[0]);
        const edge = toTileUnits(area.puntos[1]);
        const r = Math.hypot(edge.ux - c.ux, edge.uy - c.uy);
        return Math.hypot(p.ux - c.ux, p.uy - c.uy) <= r;
      }
      if (area.tipo === "rectangulo" && area.puntos.length >= 2) {
        const a = toTileUnits(area.puntos[0]);
        const b = toTileUnits(area.puntos[1]);
        const minX = Math.min(a.ux, b.ux);
        const maxX = Math.max(a.ux, b.ux);
        const minY = Math.min(a.uy, b.uy);
        const maxY = Math.max(a.uy, b.uy);
        return p.ux >= minX && p.ux <= maxX && p.uy >= minY && p.uy <= maxY;
      }
      if (area.tipo === "poligono" && area.puntos.length >= 3) {
        // Ray casting estándar
        const pts = area.puntos.map(toTileUnits);
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const xi = pts[i].ux,
            yi = pts[i].uy;
          const xj = pts[j].ux,
            yj = pts[j].uy;
          const intersect =
            yi > p.uy !== yj > p.uy &&
            p.ux < ((xj - xi) * (p.uy - yi)) / (yj - yi) + xi;
          if (intersect) inside = !inside;
        }
        return inside;
      }
      return false;
    },
    [toTileUnits, isCiudadVisibleParaHit],
  );

  const findMarkerAt = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const s = cssToCanvasScale();
      const { x: cx, y: cy, scale } = camRef.current;
      const px = (clientX - rect.left) * s;
      const py = (clientY - rect.top) * s;
      const allMarkers = editMode ? [...markers, ...hiddenMarkers] : markers;
      for (const m of [...allMarkers].reverse()) {
        const { mx, my } = getMarkerScreenPos(m, cx, cy, scale);
        if (Math.hypot(px - mx, py - my) < 12) return m;
      }
      return null;
    },
    [cssToCanvasScale, editMode, markers, hiddenMarkers, getMarkerScreenPos],
  );

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const zoomAt = useCallback((clientX: number, clientY: number, delta: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const s = cssToCanvasScale();
    const ox = (clientX - rect.left) * s;
    const oy = (clientY - rect.top) * s;
    const cam = camRef.current;
    const newScale = Math.max(
      0.1,
      Math.min(10, cam.scale * (1 - delta * 0.001)),
    );
    const ratio = newScale / cam.scale;
    camRef.current = {
      scale: newScale,
      x: ox - (ox - cam.x) * ratio,
      y: oy - (oy - cam.y) * ratio,
    };
  }, [cssToCanvasScale]);

  const zoomIn = useCallback(() => {
    const c = canvasRef.current;
    if (c) zoomAt(c.width / 2, c.height / 2, -300);
    markDirty();
  }, [zoomAt, markDirty]);

  const zoomOut = useCallback(() => {
    const c = canvasRef.current;
    if (c) zoomAt(c.width / 2, c.height / 2, 300);
    markDirty();
  }, [zoomAt, markDirty]);

  // ── Precalcular ghost grid cuando cambian los tiles (solo editMode) ──────
  useEffect(() => {
    if (!editMode || tiles.length === 0) {
      ghostGridRef.current = null;
    } else {
      const tileSet = new Set(tiles.map((t) => `${t.col},${t.row}`));
      const cols = tiles.map((t) => t.col);
      const rows = tiles.map((t) => t.row);
      ghostGridRef.current = {
        gMinCol: Math.min(...cols) - 1,
        gMinRow: Math.min(...rows) - 1,
        gMaxCol: Math.max(...cols) + 1,
        gMaxRow: Math.max(...rows) + 1,
        tileSet,
      };
    }
    markDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, tilesKey, markDirty]);

  // Invalidar caché de labels cuando cambian los markers
  useEffect(() => {
    labelCacheRef.current.clear();
    markDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markersKey, hiddenMarkersKey, markDirty]);

  // Redibujar cuando cambian las áreas o la selección/herramienta de dibujo
  useEffect(() => {
    markDirty();
  }, [areas, selectedAreaId, drawTool, markDirty]);

  // ── Draw loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    markDirty();

    const draw = (t: number) => {
      const hasSelectedPin = !!selectedMarkerId;

      // Solo redibujar si hay cambios o si hay animación de pulso activa
      if (!dirtyRef.current && !hasSelectedPin) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }
      dirtyRef.current = false;
      pulseRef.current = t;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const { accent, bg, labelText, isDark } = cssColorsRef.current;
      ctx.fillStyle = fondoColor || bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const { x: cx, y: cy, scale } = camRef.current;
      const iw = totalW * scale;
      const ih = totalH * scale;
      const ts = tileSize * scale;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "low";

      ctx.save();
      ctx.translate(cx, cy);

      // ── Grilla fantasma (editMode) ────────────────────────────────────────
      if (editMode && ghostGridRef.current) {
        const { gMinCol, gMinRow, gMaxCol, gMaxRow, tileSet } =
          ghostGridRef.current;
        const ghostFill = isDark
          ? "rgba(255,255,255,0.06)"
          : "rgba(0,0,0,0.03)";
        const ghostStroke = isDark
          ? "rgba(255,255,255,0.6)"
          : "rgba(0,0,0,0.5)";
        const hoveredGhost = ghostHoverRef.current;

        ctx.setLineDash([4, 4]);
        for (let c = gMinCol; c <= gMaxCol; c++) {
          for (let r = gMinRow; r <= gMaxRow; r++) {
            if (tileSet.has(`${c},${r}`)) continue;
            const tx = (c - minCol) * ts;
            const ty = (r - minRow) * ts;
            const isHov = hoveredGhost?.col === c && hoveredGhost?.row === r;
            ctx.globalAlpha = isHov ? 0.35 : 0.18;
            ctx.fillStyle = ghostFill;
            ctx.fillRect(tx, ty, ts, ts);
            ctx.strokeStyle = ghostStroke;
            ctx.lineWidth = isHov ? 1.5 : 1;
            ctx.strokeRect(tx + 0.5, ty + 0.5, ts - 1, ts - 1);
            if (ts > 60) {
              ctx.globalAlpha = isHov ? 0.4 : 0.15;
              ctx.fillStyle = isDark ? "#fff" : "#000";
              ctx.font = `bold ${Math.min(ts * 0.18, 28)}px sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("+", tx + ts / 2, ty + ts / 2);
              ctx.textAlign = "left";
              ctx.textBaseline = "alphabetic";
            }
          }
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // ── Tiles compuestos ─────────────────────────────────────────────────
      if (compositeRef.current && compositeReadyRef.current) {
        // Viewport culling: el composite puede ser enorme (tileSize=1024 por
        // tile). Reescalar el mapa entero en cada frame durante pan/zoom es
        // carísimo aunque solo se vea una fracción en pantalla — por eso acá
        // recortamos tanto el source como el destino a la región visible.
        const visX0 = Math.max(0, -cx);
        const visY0 = Math.max(0, -cy);
        const visX1 = Math.min(iw, canvas.width - cx);
        const visY1 = Math.min(ih, canvas.height - cy);

        if (visX1 > visX0 && visY1 > visY0) {
          const srcX0 = visX0 / scale;
          const srcY0 = visY0 / scale;
          const srcW = (visX1 - visX0) / scale;
          const srcH = (visY1 - visY0) / scale;
          ctx.drawImage(
            compositeRef.current,
            srcX0,
            srcY0,
            srcW,
            srcH,
            visX0,
            visY0,
            visX1 - visX0,
            visY1 - visY0,
          );
        }
      } else if (tiles.length === 0) {
        // Sin ningún tile todavía: dibujamos un placeholder del área virtual
        // 1×1 (ver totalCols/totalRows más arriba) para que se note que hay
        // "algo" ahí en vez de dejar el canvas completamente en blanco.
        ctx.fillStyle = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)";
        ctx.fillRect(0, 0, ts, ts);
        ctx.strokeStyle = `rgba(${isDark ? "255,255,255" : "0,0,0"},0.1)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(0, 0, ts, ts);
        ctx.setLineDash([]);
      } else {
        // Mientras carga el composite (o si no hay imágenes), dibujamos el fondo de cada tile
        tiles.forEach((tile) => {
          const tx = (tile.col - minCol) * ts;
          const ty = (tile.row - minRow) * ts;
          ctx.fillStyle = isDark
            ? "rgba(255,255,255,0.04)"
            : "rgba(0,0,0,0.06)";
          ctx.fillRect(tx, ty, ts, ts);
        });
      }

      // ── Bordes de tiles existentes ────────────────────────────────────────
      if (tiles.length > 1) {
        ctx.strokeStyle = `rgba(${isDark ? "255,255,255" : "0,0,0"},0.12)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let c = 0; c <= totalCols; c++) {
          const x = c * ts;
          ctx.moveTo(x, 0);
          ctx.lineTo(x, ih);
        }
        for (let r = 0; r <= totalRows; r++) {
          const y = r * ts;
          ctx.moveTo(0, y);
          ctx.lineTo(iw, y);
        }
        ctx.stroke();
      }

      // ── Hover tile highlight ──────────────────────────────────────────────
      const hovered = hoverTileRef.current;
      if (hovered && editMode) {
        const tx = (hovered.col - minCol) * ts;
        const ty = (hovered.row - minRow) * ts;
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(tx, ty, ts, ts);
        ctx.strokeStyle = `${accent}55`;
        ctx.lineWidth = 2;
        ctx.strokeRect(tx, ty, ts, ts);
      }

      // ── Áreas (círculo/rectángulo/polígono) ────────────────────────────────
      const drawAreaShape = (
        pts: { lx: number; ly: number }[],
        tipo: BaseArea["tipo"],
      ) => {
        ctx.beginPath();
        if (tipo === "circulo" && pts.length >= 2) {
          const [c, edge] = pts;
          const r = Math.hypot(edge.lx - c.lx, edge.ly - c.ly);
          ctx.arc(c.lx, c.ly, r, 0, Math.PI * 2);
        } else if (tipo === "rectangulo" && pts.length >= 2) {
          const [a, b] = pts;
          const x = Math.min(a.lx, b.lx);
          const y = Math.min(a.ly, b.ly);
          ctx.rect(x, y, Math.abs(b.lx - a.lx), Math.abs(b.ly - a.ly));
        } else if (tipo === "poligono" && pts.length >= 2) {
          ctx.moveTo(pts[0].lx, pts[0].ly);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].lx, pts[i].ly);
          if (pts.length >= 3) ctx.closePath();
        }
      };

      // Umbral de zoom para decidir cómo se pinta un área de Reino (sin
      // ciudad_id): por debajo, coloreada + nombre centrado, como siempre;
      // por encima (zoomeado adentro), el relleno estorba para ver el
      // territorio así que solo se marca el borde, con el nombre pegado a
      // él en vez de tapando el centro.
      const REINO_ZOOM_CERCANO_TS = 420;
      const zoomCercano = ts > REINO_ZOOM_CERCANO_TS;

      // Umbral de zoom para áreas de Ciudad: de lejos no se muestran (ni
      // relleno ni nombre) — a esa escala un puñado de ciudades por reino
      // satura el mapa. Al acercarse (mismo umbral que el reino, ver
      // CIUDAD_ZOOM_CERCANO_TS más arriba, reusada también dentro de
      // isPointInArea para que dibujo y hit-testing nunca diverjan)
      // aparecen coloreadas + nombre, igual que siempre. En editMode, de
      // lejos se deja ver un borde tenue sin relleno ni label — sin eso el
      // admin no tiene forma de ubicar/clickear una ciudad sin adivinar o
      // zoomear a ciegas por todo el mapa.
      const ciudadVisible = ts > CIUDAD_ZOOM_CERCANO_TS;

      for (const area of areas) {
        const esCiudad = !!area.ciudad_id;
        if (esCiudad && !ciudadVisible && !editMode) continue;

        const localPts = area.puntos.map((p) => worldToLocal(p, scale));
        const isSel = area.id === selectedAreaId;
        const baseColor = area.color || accent;
        const esReinoPuro = !!area.reino_id && !area.ciudad_id;
        const ciudadLejosEnEdicion = esCiudad && !ciudadVisible && editMode;
        const soloBorde = (esReinoPuro && zoomCercano) || ciudadLejosEnEdicion;

        drawAreaShape(localPts, area.tipo);
        if (!soloBorde) {
          ctx.fillStyle = `${baseColor}${isSel ? "33" : "22"}`;
          ctx.fill();
        }
        ctx.globalAlpha = ciudadLejosEnEdicion && !isSel ? 0.35 : 1;
        ctx.strokeStyle = isSel ? baseColor : `${baseColor}bb`;
        ctx.lineWidth = isSel ? 2.5 : soloBorde ? 2 : 1.5;
        if (area.tipo === "poligono") ctx.setLineDash([]);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Vértices editables (solo en editMode + área seleccionada)
        if (editMode && isSel) {
          for (const p of localPts) {
            ctx.beginPath();
            ctx.arc(p.lx, p.ly, 5, 0, Math.PI * 2);
            ctx.fillStyle = baseColor;
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }

        // Label — centrado en la forma normalmente; en modo "solo borde" de
        // un Reino con zoom cercano se ancla al punto más alto del borde en
        // vez de tapar el interior (ahí no hay relleno que lo resalte del
        // Label — centrado en la forma normalmente. Se oculta del todo (sin
        // dibujarse en ningún lado) en modo "solo borde": un Reino con zoom
        // cercano no muestra su nombre — a esa escala se está viendo el
        // territorio de cerca, no identificándolo desde lejos. Una Ciudad
        // lejos en editMode tampoco muestra label — mismo criterio, el
        // nombre recién aparece al acercarse (ver "ciudad visible").
        if (area.label && localPts.length >= 2 && !soloBorde) {
          let lx: number, ly: number;
          if (area.tipo === "poligono") {
            lx = localPts.reduce((s, p) => s + p.lx, 0) / localPts.length;
            ly = localPts.reduce((s, p) => s + p.ly, 0) / localPts.length;
          } else {
            lx = (localPts[0].lx + localPts[1].lx) / 2;
            ly = (localPts[0].ly + localPts[1].ly) / 2;
          }
          ctx.font = "700 11px 'Cinzel', serif";
          ctx.textAlign = "center";
          ctx.fillStyle = labelText;
          ctx.globalAlpha = 0.85;
          ctx.fillText(area.label, lx, ly);
          ctx.globalAlpha = 1;
          ctx.textAlign = "left";
        }
      }

      // ── Dibujo en curso (herramienta activa) ────────────────────────────────
      if (editMode && drawTool) {
        const curPts = drawingPoints;
        const cursor = drawCursorRef.current;
        const previewPts = [...curPts];
        if (cursor) previewPts.push(cursor);
        if (previewPts.length >= 1) {
          const localPts = previewPts.map((p) => worldToLocal(p, scale));
          if (localPts.length >= 2) {
            ctx.setLineDash(drawTool === "poligono" ? [5, 4] : []);
            drawAreaShape(localPts, drawTool);
            ctx.fillStyle = `${accent}22`;
            ctx.fill();
            ctx.strokeStyle = accent;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);
          }
          // Puntos ya fijados del polígono (antes del cursor)
          if (drawTool === "poligono") {
            for (const p of curPts.map((p) => worldToLocal(p, scale))) {
              ctx.beginPath();
              ctx.arc(p.lx, p.ly, 4, 0, Math.PI * 2);
              ctx.fillStyle = accent;
              ctx.fill();
            }
          }
        }
      }

      // ── Pins ─────────────────────────────────────────────────────────────
      // Los pines (punto + etiqueta flotante) se eliminaron: los
      // reinos/ciudades se representan únicamente mediante áreas (círculo /
      // rectángulo / polígono), dibujadas más arriba. No se dibuja nada más
      // por cada marker aquí, ni siquiera en editMode.

      ctx.restore();

      // ── Papelera flotante ─────────────────────────────────────────────────
      trashRectRef.current = null;
      if (hovered && editMode && !selectedMarkerId) {
        const tx = cx + (hovered.col - minCol) * ts;
        const ty = cy + (hovered.row - minRow) * ts;
        const size = 22;
        const rx = tx + ts - size - 6;
        const ry = ty + 6;
        if (ts > 40) {
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.beginPath();
          void (
            (ctx as any).roundRect?.(rx, ry, size, size, 5) ??
            ctx.rect(rx, ry, size, size)
          );
          ctx.fill();
          trashRectRef.current = {
            x: rx,
            y: ry,
            w: size,
            h: size,
            tile: hovered,
          };
        }
      }

      // ── Hint pin seleccionado ─────────────────────────────────────────────
      if (selectedMarkerId) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, canvas.height - 36, canvas.width, 36);
        ctx.fillStyle = "#fff";
        ctx.font = "700 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          "Tocá el mapa para mover el punto",
          canvas.width / 2,
          canvas.height - 14,
        );
        ctx.textAlign = "left";
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    compositeReady,
    editMode,
    fondoColor,
    selectedMarkerId,
    markersKey,
    hiddenMarkersKey,
    tilesKey,
    totalW,
    totalH,
    tileSize,
    totalCols,
    totalRows,
    minCol,
    minRow,
    ghostHover,
    getMarkerScreenPos,
    areas,
    selectedAreaId,
    drawTool,
    drawingPoints,
    worldToLocal,
    markDirty,
  ]);

  return {
    canvasRef,
    containerRef,
    camRef,
    ghostGridRef,
    trashRectRef,
    markDirty,
    cssToCanvasScale,
    getMarkerScreenPos,
    worldToLocal,
    canvasToTileInfo,
    clientToWorldPoint,
    findTileAt,
    toTileUnits,
    fromTileUnits,
    isPointInArea,
    findMarkerAt,
    zoomAt,
    zoomIn,
    zoomOut,
    minCol,
    minRow,
    totalCols,
    totalRows,
    totalW,
    totalH,
  };
}
