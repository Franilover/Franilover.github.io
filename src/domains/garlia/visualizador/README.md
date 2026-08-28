# Visualizador — Laboratorio visual de Garlia

## Objetivo

`VisualizadorPage.tsx` es la V1 visual del laboratorio de Garlia. **No tiene ruta propia**: debe mostrarse como la segunda tab hermana de `Sandbox` mediante `SandboxVisualizadorTabs.tsx`.

El Sandbox sigue siendo el entorno de simulación experimental. Visualizador es la capa de explicación, inspección y lectura visual del mismo universo.

## Integración

Montaje esperado:

```tsx
<SandboxVisualizadorTabs />
```

en el punto donde actualmente se renderiza `SandboxPage`.

La barra debe quedar visualmente así:

`Sandbox | Visualizador`

No crear `/garlia/visualizador` ni otra ruta paralela.

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

## Componentes

`SandboxVisualizadorTabs.tsx` es el shell de integración.

La V1 visual puede evolucionar a componentes reutilizables como:

- `FlowNode`
- `MetricCard`
- `MiniBarChart`
- `LineChart`
- `FormulaExplorer`
- `GenealogyGraph`
- `PropertyInspector`
- `CausalTrace`

Reutilizar `PropertyControl.tsx`; no duplicar su lógica.

## Datos reales

Los adapters deben consumir preferentemente vistas/contratos ya existentes:

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

## Partículas propias de Garlia

Las “partículas” del visualizador son las partículas fundamentales propias de Garlia: Masa, Cinética, Potencial, Información, Voluntad, Percepción, Transición, Ciclo, Entropía, Catálisis y Equilibrio.

No introducir protones/electrones/neutrones como parte del modelo de Garlia.