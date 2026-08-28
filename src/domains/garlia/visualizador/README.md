# Visualizador — Laboratorio visual de Garlia

## Objetivo

`VisualizadorPage.tsx` es una primera V1 navegable de una nueva sección de Garlia dedicada a **explicar visualmente el sistema del universo**. No reemplaza Sandbox, Física, Runas ni los editores existentes.

Ruta pública: `/garlia/visualizador`.

## Principio

Supabase es la fuente de verdad. El visualizador debe mostrar relaciones, fórmulas, propiedades, estados y causalidad que ya existan en contratos/vistas del backend.

La V1 contiene fixtures visuales únicamente para construir y revisar UX. Ningún número de la pantalla debe considerarse canon.

## Vistas V1

1. **Micro → Macro** — Partículas → IUMs → Elementos → Compuestos → Materiales → Estructuras → Estado.
2. **A / T / S** — composición visual de partículas mediante Tesis, Antítesis y Síntesis.
3. **Fórmulas** — relación interactiva de una propiedad cuando exista fórmula y dependencias conocidas; V1 usa densidad como demostración.
4. **Material** — perfil visual de propiedades mecánicas/reactivas.
5. **Estructura** — material → componentes → interfaces → geometría → respuesta estructural.
6. **Reactividad** — composición → perfil reactivo → procesos posibles.
7. **Energía** — evolución temporal con gráfico.
8. **Electricidad** — carga → conductividad → flujo → destino.
9. **Información** — fuente → propagación → receptor, mostrando intensidad y fidelidad.
10. **Oris / Éterium** — partículas/IUMs → Oris → perfil → acoplamiento.
11. **Runas** — patrón → semántica → operación → mecanismo, sin asumir hechizos.
12. **Proceso** — evento → interacción → proceso → mecanismo → efecto → nuevo estado.

## Componentes objetivo

La V1 está concentrada en una página para facilitar revisión. En la siguiente iteración el equipo puede extraer componentes reutilizables:

- `FlowNode`
- `MetricCard`
- `MiniBarChart`
- `LineChart`
- `FormulaExplorer`
- `GenealogyGraph`
- `PropertyInspector`
- `CausalTrace`
- `VisualizadorNav`

No duplicar la lógica de `PropertyControl.tsx`; reutilizar el componente ya existente para controles de propiedades.

## Datos reales

Los adapters reales deben consumir preferentemente vistas/contratos ya existentes, por ejemplo:

- propiedades calculadas/canónicas
- genealogía micro → macro
- perfiles de Oris
- acoplamiento Éterium
- semántica de Runas
- procesos/mecanismos
- trazas del Sandbox

Si un dato no existe aún en Supabase, mostrar `sin datos`, `experimental` o `pendiente`; nunca inventarlo en TypeScript.

## Gráficos

Un gráfico debe existir cuando ayude a explicar:

- relación entre magnitudes
- evolución temporal
- comparación entre perfiles
- distribución de propiedades
- procedencia/genealogía
- propagación o causalidad

No añadir gráficos como decoración.

## Interactividad

El visualizador puede permitir exploración y, cuando el contrato lo autorice, edición experimental. La edición real de estado debe pasar por las APIs/RPCs canónicas; React no debe ejecutar reglas de física, química, magia o simulación.

## Punto especialmente importante

Las “partículas” del visualizador son las partículas fundamentales propias de Garlia (Masa, Cinética, Potencial, Información, Voluntad, Percepción, Transición, Ciclo, Entropía, Catálisis y Equilibrio). No introducir protones/electrones/neutrones como parte del modelo de Garlia.
