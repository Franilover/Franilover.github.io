# Estado de los cambios en este tar

## ✅ Completo y probado
- Fix hit-test de assets (findMarkerAt) en useTileCanvasEngine.ts
- Fix onMarkerContextMenu sin bifurcar por asset-placement: (mapaGarlia.tsx, ReinoTileCanvas.tsx)
- ReinoTileCanvas.tsx desactivado por completo (documentado, sin borrar el archivo):
  - EditorReino.tsx ya no lo usa (MapaConPuntosComponent quitado)
  - mapaGarlia.tsx ya no lo usa (vistaActual nunca llega a "reino")
  - reinos/index.ts sigue exportándolo con nota de que está muerto
- Tabla map_tile_terrain creada en Supabase (proyecto Franiloverart,
  ftdxthnizdosaaavjhah), con RLS admin-write/read-all igual que map_tiles.

## 🚧 A MEDIAS — falta terminar antes de usar
Sistema de terreno decorativo (pintar verde/azul/café sobre tiles):

- UnifiedTileCanvas.tsx: tipos (TerrainColor, TerrainTool, BaseTileTerrain,
  etc.) y props nuevas (terrain, terrainTool, onTerrainChange,
  onTerrainStrokeEnd) YA AGREGADAS y conectadas al engine/editing.
- tileCanvasEditingGestures.ts: lógica COMPLETA de pintado (pointerdown/
  move/up, pincel libre celda-a-celda en grilla 16x16, click simple pinta
  tile entero, onTerrainStrokeEnd al soltar) YA ESCRITA.
- useTileCanvasEngine.ts: tipos/props/useEffect de invalidación agregados,
  pero FALTA el bloque de dibujo real en el draw loop (dónde: entre "fondo
  de cada tile" ~línea 774 y "Bordes de tiles existentes" ~línea 785).
  Sin esto, nada se ve pintado en pantalla todavía.
- FALTA: wiring en mapaGarlia.tsx (cargar terrain desde Supabase, estado
  React, dropdown de color/borrador en la barra de herramientas, upsert a
  map_tile_terrain en onTerrainStrokeEnd).
- FALTA: cache offline en Dexie para map_tile_terrain (mismo patrón que
  map_tiles).

Es seguro compilar/usar esto tal cual: todo lo nuevo tiene defaults
(terrain=[], terrainTool=null) que no cambian el comportamiento existente.
Simplemente el pintado de terreno todavía no tiene efecto visual ni se
guarda en ningún lado hasta terminar los puntos de arriba.
