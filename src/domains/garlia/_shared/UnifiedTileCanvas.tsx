"use client";

/**
 * UnifiedTileCanvas
 * ──────────────────
 * Canvas compartido entre EditorMapa (mundo) y ReinoTileCanvas (reino).
 * Une "puntos de interés" + "tiles" en una sola superficie:
 *
 *   - Pan / zoom (rueda + drag, pinch en touch)
 *   - Dibuja los tiles compuestos en un OffscreenCanvas
 *   - Dibuja marcadores (pins) encima, con su label
 *   - Click contextual:
 *       1. Si hay un pin seleccionado     → lo mueve a la posición tocada
 *       2. Si el click cae en la papelera flotante de un tile (hover)
 *                                          → confirma + elimina ese tile
 *       3. Si el click cae sobre un pin   → lo selecciona
 *       4. Si cae dentro de un tile       → abre el picker de imagen
 *       5. Si cae fuera de cualquier tile → no hace nada
 *   - Ctrl+click en casilla fantasma → crea tile nuevo en esa posición
 *     (las coordenadas son cartesianas: soporta negativos en todas direcciones)
 *   - Hover sobre un tile → muestra una papelera pequeña en su esquina
 *     superior derecha para eliminarlo
 *
 * Este componente NO sabe nada de Supabase: todo I/O se delega a props.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Tipos compartidos ────────────────────────────────────────────────────────
export type BaseTile = {
  id: string;
  col: number;
  row: number;
  image_url: string | null;
  label?: string | null;
};

/** Alias de BaseTile para compatibilidad con código existente */
export type MapTile = BaseTile;

export type BaseMarker = {
  id: string;
  nombre?: string;
  name?: string;
  coord_x?: number | null;
  coord_y?: number | null;
  tile_col?: number | null;
  tile_row?: number | null;
  oculto?: boolean;
};

interface UnifiedTileCanvasProps<
  TTile extends BaseTile,
  TMarker extends BaseMarker,
> {
  tiles: TTile[];
  markers: TMarker[];
  hiddenMarkers?: TMarker[];
  tileSize?: number;
  editMode: boolean;

  // ── Marcadores ──────────────────────────────────────────────────────────
  selectedMarkerId?: string | null;
  onMarkerSelect: (id: string | null) => void;
  onMarkerMove: (
    markerId: string,
    coord: { x: number; y: number; tile_col: number; tile_row: number },
  ) => void;
  onMarkerClick?: (marker: TMarker) => void;

  // ── Tiles ───────────────────────────────────────────────────────────────
  /** Abre el picker de imagen para el tile indicado (existente). */
  onTilePick: (tile: TTile) => void;
  /** Elimina el tile indicado (ya confirmado). */
  onTileDelete: (tile: TTile) => void;
  /** Crea un tile nuevo en (col, row). El sistema soporta negativos. */
  onTileCreate: (col: number, row: number) => void;

  // ── Extras opcionales (usados por el mapa del mundo) ─────────────────────
  fondoColor?: string | null;
  isFirstOpen?: boolean;
  eyedropperActive?: boolean;
  onEyedropperPick?: (color: string) => void;
  onMapClick?: (
    x: number,
    y: number,
    tile_col?: number,
    tile_row?: number,
  ) => void;
  onOpenPanel?: () => void;

  className?: string;
}

export function UnifiedTileCanvas<
  TTile extends BaseTile,
  TMarker extends BaseMarker,
>({
  tiles,
  markers,
  hiddenMarkers = [],
  tileSize = 1024,
  editMode,
  selectedMarkerId = null,
  onMarkerSelect,
  onMarkerMove,
  onMarkerClick,
  onTilePick,
  onTileDelete,
  onTileCreate,
  fondoColor,
  isFirstOpen: _isFirstOpen,
  eyedropperActive,
  onEyedropperPick,
  onMapClick,
  onOpenPanel: _onOpenPanel,
  className,
}: UnifiedTileCanvasProps<TTile, TMarker>) {
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
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, camX: 0, camY: 0 });
  const lastPinchDist = useRef<number | null>(null);
  // Cantidad de touches activos — usado para que el pan por Pointer Events no
  // pelee con el pinch-zoom por Touch Events durante un gesto de 2 dedos.
  const touchCountRef = useRef(0);
  // pointerIds de dedos activos, seguidos directo desde Pointer Events (sin
  // depender del evento touchstart nativo, que no siempre llega al mismo
  // tiempo que pointerdown — esa carrera era la causa del salto al segundo
  // toque).
  const activeTouchPointers = useRef<Set<number>>(new Set());
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
  const markDirty = () => {
    dirtyRef.current = true;
  };

  const cssColorsRef = useRef({
    primary: "#6b4423",
    accent: "#c08040",
    bg: "#f0e6d0",
    fg: "#2a1304",
    labelBg: "#fdf6ee",
    labelText: "#2a1304",
    isDark: false,
  });

  // Tile bajo el cursor (para mostrar la papelera flotante)
  const [hoverTile, setHoverTile] = useState<TTile | null>(null);
  const hoverTileRef = useRef<TTile | null>(null);
  // Casilla fantasma bajo el cursor (col/row de celda vacía en editMode)
  const ghostHoverRef = useRef<{ col: number; row: number } | null>(null);
  const [ghostHover, setGhostHover] = useState<{
    col: number;
    row: number;
  } | null>(null);
  // Rect (en coords de pantalla) de la papelerita activa, para detectar el click
  const trashRectRef = useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
    tile: TTile;
  } | null>(null);

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
  }, [
    tiles.map((t) => `${t.col}:${t.row}:${t.image_url}`).join("|"),
    tileSize,
    totalW,
    totalH,
  ]);

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
  }, [totalW, totalH]);

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
      const { w, h } = capDims(container.clientWidth, container.clientHeight);
      canvas.width = w;
      canvas.height = h;
      renderScaleRef.current = container.clientWidth
        ? w / container.clientWidth
        : 1;
      centerImage();
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
  const cssToCanvasScale = () => renderScaleRef.current;

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

  const canvasToTileInfo = (clientX: number, clientY: number) => {
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
  };

  const findTileAt = (col: number, row: number) =>
    tiles.find((t) => t.col === col && t.row === row) ?? null;

  const findMarkerAt = (clientX: number, clientY: number) => {
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
  };

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const zoomAt = (clientX: number, clientY: number, delta: number) => {
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
  };

  // ── Precalcular ghost grid cuando cambian los tiles ──────────────────────
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
  }, [editMode, tiles]);

  // Invalidar caché de labels cuando cambian los markers
  useEffect(() => {
    labelCacheRef.current.clear();
    markDirty();
  }, [markers, hiddenMarkers]);

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

      const { accent, bg, labelBg, labelText, isDark } = cssColorsRef.current;
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

      // ── Pins ─────────────────────────────────────────────────────────────
      const pulse = hasSelectedPin ? (Math.sin(t / 600) + 1) / 2 : 0;
      const allMarkers = editMode ? [...markers, ...hiddenMarkers] : markers;

      for (const m of allMarkers) {
        const { mx, my } = getMarkerScreenPos(m, 0, 0, scale);
        const isSelected = m.id === selectedMarkerId;
        const isHidden = hiddenMarkers.some((h) => h.id === m.id);
        const markerColor = isHidden ? "rgba(120,120,120,0.5)" : accent;

        if (isSelected) {
          const r = 14 + pulse * 4;
          const grd = ctx.createRadialGradient(mx, my, 0, mx, my, r);
          grd.addColorStop(0, `${accent}55`);
          grd.addColorStop(1, `${accent}00`);
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(mx, my, r, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(mx, my, isSelected ? 6 : 5, 0, Math.PI * 2);
        ctx.fillStyle = markerColor;
        ctx.fill();
        ctx.strokeStyle = isDark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.8)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();

      // ── Labels (fuera del transform) ──────────────────────────────────────
      const allMarkers2 = editMode ? [...markers, ...hiddenMarkers] : markers;
      ctx.font = "700 11px 'Cinzel', serif";
      const cache = labelCacheRef.current;

      for (const m of allMarkers2) {
        if (hiddenMarkers.some((h) => h.id === m.id)) continue;
        const label = m.nombre || m.name || "";
        if (!label) continue;
        const { mx, my } = getMarkerScreenPos(m, cx, cy, scale);
        let tw = cache.get(m.id);
        if (tw === undefined) {
          tw = ctx.measureText(label).width;
          cache.set(m.id, tw);
        }
        const pad = 5;
        const lx = mx - tw / 2 - pad;
        const ly = my + 10;
        ctx.fillStyle = `${labelBg}ee`;
        ctx.beginPath();
        void (
          (ctx as any).roundRect?.(lx, ly, tw + pad * 2, 18, 3) ??
          ctx.rect(lx, ly, tw + pad * 2, 18)
        );
        ctx.fill();
        ctx.fillStyle = labelText;
        ctx.fillText(label, mx - tw / 2, ly + 12);
      }

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
     
  }, [
    compositeReady,
    editMode,
    fondoColor,
    selectedMarkerId,
    markers,
    hiddenMarkers,
    tiles,
    totalW,
    totalH,
    tileSize,
    totalCols,
    totalRows,
    minCol,
    minRow,
    ghostHover,
    getMarkerScreenPos,
  ]);

  // ── Detectar borde para doble-click de expansión ─────────────────────────
  // ── Eventos ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Zoom: solo Ctrl+scroll (siempre, en todos los modos) ─────────────────
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY);
      markDirty();
    };

    // ── Pan: drag con click presionado (sin modificador) ──────────────────────
    let isPointerDown = false;
    let pointerDownCtrl = false;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType !== "touch") return;

      if (e.pointerType === "touch") {
        activeTouchPointers.current.add(e.pointerId);
        if (activeTouchPointers.current.size >= 2) {
          // Segundo dedo tocando: es el arranque de un pinch, no de un pan.
          // No reseteamos dragStart ni capturamos el pointer — si no, el
          // primer dedo (que sigue moviéndose y generando sus propios
          // pointermove) calcularía su delta contra la posición del segundo
          // dedo y el mapa "saltaría" de golpe.
          isPointerDown = false;
          isDragging.current = false;
          return;
        }
      }

      isPointerDown = true;
      pointerDownCtrl = e.ctrlKey || e.metaKey;
      isDragging.current = false;
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        camX: camRef.current.x,
        camY: camRef.current.y,
      };
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      // Durante un pinch de 2 dedos, el pan por Pointer Events se desactiva
      // — si no, pelea con el zoomAt del pinch (ver onTouchStart/Move/End) y
      // al levantar un dedo el mapa "salta" a la posición corrupta.
      if (isPointerDown && touchCountRef.current < 2) {
        const s = cssToCanvasScale();
        const dx = (e.clientX - dragStart.current.x) * s;
        const dy = (e.clientY - dragStart.current.y) * s;
        if (Math.hypot(dx, dy) > 6) isDragging.current = true;
        if (isDragging.current) {
          camRef.current = {
            ...camRef.current,
            x: dragStart.current.camX + dx,
            y: dragStart.current.camY + dy,
          };
          markDirty();
        }
      }

      // Hover en editMode: tile existente (papelera) y casilla fantasma (Ctrl)
      if (editMode && !isDragging.current) {
        const info = canvasToTileInfo(e.clientX, e.clientY);
        const tile = info ? findTileAt(info.tile_col, info.tile_row) : null;
        if (tile?.id !== hoverTileRef.current?.id) {
          hoverTileRef.current = tile;
          setHoverTile(tile);
          markDirty();
        }
        if (info && !tile) {
          const ghost = ghostGridRef.current;
          const inZone =
            ghost &&
            info.tile_col >= ghost.gMinCol &&
            info.tile_col <= ghost.gMaxCol &&
            info.tile_row >= ghost.gMinRow &&
            info.tile_row <= ghost.gMaxRow &&
            !ghost.tileSet.has(`${info.tile_col},${info.tile_row}`);
          if (inZone) {
            const g = ghostHoverRef.current;
            if (!g || g.col !== info.tile_col || g.row !== info.tile_row) {
              ghostHoverRef.current = {
                col: info.tile_col,
                row: info.tile_row,
              };
              setGhostHover({ col: info.tile_col, row: info.tile_row });
              markDirty();
            }
          } else if (ghostHoverRef.current) {
            ghostHoverRef.current = null;
            setGhostHover(null);
            markDirty();
          }
        } else {
          if (ghostHoverRef.current) {
            ghostHoverRef.current = null;
            setGhostHover(null);
            markDirty();
          }
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === "touch")
        activeTouchPointers.current.delete(e.pointerId);
      isPointerDown = false;
      if (isDragging.current) {
        isDragging.current = false;
        return;
      }

      const withCtrl = pointerDownCtrl || e.ctrlKey || e.metaKey;
      const clientX = e.clientX;
      const clientY = e.clientY;

      // ── Eyedropper (siempre tiene prioridad) ────────────────────────────────
      if (eyedropperActive) {
        const ctx2 = canvas.getContext("2d");
        if (ctx2) {
          const rect2 = canvas.getBoundingClientRect();
          const s2 = cssToCanvasScale();
          const [r, g, b] = ctx2.getImageData(
            Math.round((clientX - rect2.left) * s2),
            Math.round((clientY - rect2.top) * s2),
            1,
            1,
          ).data;
          onEyedropperPick?.(
            "#" +
              [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join(""),
          );
        }
        return;
      }

      // ── Si hay pin seleccionado esperando ser movido → depositarlo ──────────
      if (selectedMarkerId) {
        const info = canvasToTileInfo(clientX, clientY);
        if (info) {
          onMarkerMove(selectedMarkerId, {
            x: info.x,
            y: info.y,
            tile_col: info.tile_col,
            tile_row: info.tile_row,
          });
        }
        return;
      }

      // ── Click en la papelera flotante (solo editMode) ────────────────────────
      if (editMode) {
        const trash = trashRectRef.current;
        const rect = canvas.getBoundingClientRect();
        const s3 = cssToCanvasScale();
        const px = (clientX - rect.left) * s3;
        const py = (clientY - rect.top) * s3;
        if (
          trash &&
          px >= trash.x &&
          px <= trash.x + trash.w &&
          py >= trash.y &&
          py <= trash.y + trash.h
        ) {
          onTileDelete(trash.tile);
          return;
        }
      }

      // ── Click sobre un pin ───────────────────────────────────────────────────
      const marker = findMarkerAt(clientX, clientY);
      if (marker) {
        if (withCtrl && editMode) {
          // Ctrl + click en pin → seleccionarlo para moverlo
          onMarkerSelect(marker.id === selectedMarkerId ? null : marker.id);
        } else {
          // Click simple en pin → abrir panel (solo notificar)
          onMarkerClick?.(marker);
        }
        return;
      }

      // ── Click en tile existente (solo editMode + Ctrl) ───────────────────────
      if (editMode) {
        const info = canvasToTileInfo(clientX, clientY);
        const tile = info ? findTileAt(info.tile_col, info.tile_row) : null;
        if (tile) {
          if (withCtrl) onTilePick(tile); // Ctrl → picker de imagen
          // sin Ctrl sobre tile existente → nada
          return;
        }

        // ── Click en casilla fantasma (solo Ctrl) → crear tile en el borde ──────
        if (info && !tile && withCtrl && ghostGridRef.current) {
          const { gMinCol, gMinRow, gMaxCol, gMaxRow, tileSet } =
            ghostGridRef.current;
          const { tile_col: col, tile_row: row } = info;
          // Solo permitir si está dentro del anillo de "+" (1 casilla alrededor)
          const inGhostZone =
            col >= gMinCol &&
            col <= gMaxCol &&
            row >= gMinRow &&
            row <= gMaxRow &&
            !tileSet.has(`${col},${row}`);
          if (inGhostZone) {
            onTileCreate(col, row);
          }
          return;
        }
      }

      // ── Fallback: notificar posición (mapa del mundo, fuera de editMode) ─────
      if (!editMode) {
        const info = canvasToTileInfo(clientX, clientY);
        if (info) onMapClick?.(info.x, info.y, info.tile_col, info.tile_row);
      }
    };

    // ── Pinch zoom (touch, sin restricción de Ctrl en táctil) ────────────────
    const onTouchStart = (e: TouchEvent) => {
      touchCountRef.current = e.touches.length;
      if (e.touches.length === 2) {
        // Arranca un pinch: cancelamos cualquier pan en curso para que no
        // pelee con el zoom mientras haya 2 dedos.
        isDragging.current = false;
        lastPinchDist.current = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      touchCountRef.current = e.touches.length;
      if (e.touches.length === 2 && lastPinchDist.current !== null) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        const mid = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
        zoomAt(mid.x, mid.y, (lastPinchDist.current - dist) * 3);
        lastPinchDist.current = dist;
        markDirty();
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      touchCountRef.current = e.touches.length;
      lastPinchDist.current = null;
      if (e.touches.length === 1) {
        // Quedó 1 dedo tras un pinch: reiniciamos el punto de referencia del
        // pan con la posición ACTUAL de ese dedo — si no, el pan retoma
        // desde un dragStart viejo (mezclado entre los dos dedos) y el mapa
        // "salta" en una dirección al soltar.
        dragStart.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          camX: camRef.current.x,
          camY: camRef.current.y,
        };
        isDragging.current = false;
        isPointerDown = true;
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (e.pointerType === "touch")
        activeTouchPointers.current.delete(e.pointerId);
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editMode,
    selectedMarkerId,
    markers,
    hiddenMarkers,
    tiles,
    totalW,
    totalH,
    minCol,
    minRow,
    totalCols,
    totalRows,
  ]);

  // ── Zoom buttons ──────────────────────────────────────────────────────────
  const zoomIn = () => {
    const c = canvasRef.current;
    if (c) zoomAt(c.width / 2, c.height / 2, -300);
  };
  const zoomOut = () => {
    const c = canvasRef.current;
    if (c) zoomAt(c.width / 2, c.height / 2, 300);
  };

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden min-h-0 ${className ?? "relative flex-1"}`}
      style={{
        cursor: eyedropperActive
          ? "crosshair"
          : selectedMarkerId
            ? "crosshair"
            : hoverTile || ghostHover
              ? "pointer"
              : "default",
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none w-full h-full"
      />

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
        {[
          { l: "+", fn: zoomIn },
          { l: "−", fn: zoomOut },
        ].map(({ l, fn }) => (
          <button
            key={l}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-black shadow transition-all"
            style={{
              background: "color-mix(in srgb, var(--primary) 80%, transparent)",
              color: "#fff",
            }}
            onClick={fn}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Cancelar selección de pin */}
      {selectedMarkerId && (
        <button
          className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-micro font-black uppercase"
          style={{
            background:
              "color-mix(in srgb, var(--foreground) 70%, transparent)",
            color: "#fff",
          }}
          onClick={() => onMarkerSelect(null)}
        >
          Cancelar
        </button>
      )}

      {/* No tiles warning */}
      {tiles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p
            className="text-micro font-black uppercase tracking-widest opacity-30"
            style={{ color: "var(--foreground)" }}
          >
            Sin tiles configurados
          </p>
        </div>
      )}

      {/* Hints (solo editMode, con tiles) */}
      {editMode && tiles.length > 0 && (
        <div className="absolute top-2 left-2 z-10 pointer-events-none flex flex-col gap-1">
          <span
            className="text-micro font-bold uppercase tracking-widest px-2 py-1 rounded-lg"
            style={{
              background: "color-mix(in srgb, var(--bg-main) 85%, transparent)",
              color: "color-mix(in srgb, var(--foreground) 35%, transparent)",
            }}
          >
            Ctrl + click para editar · Ctrl + scroll para zoom
          </span>
        </div>
      )}
    </div>
  );
}
