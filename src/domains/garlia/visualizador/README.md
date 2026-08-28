# Visualizador — Laboratorio visual de Garlia

El Visualizador es una segunda tab hermana de `Sandbox`, no una ruta independiente.

## Integración

Usar `SandboxVisualizadorTabs.tsx` en el punto donde hoy se monta `SandboxPage`:

```tsx
<SandboxVisualizadorTabs />
```

La UI esperada es:

`Sandbox | Visualizador`

No crear `/garlia/visualizador`.

La pestaña Sandbox mantiene su motor y estado actuales. La pestaña Visualizador contiene la capa de explicación visual: micro→macro, A/T/S, fórmulas, materiales, estructuras, reactividad, energía, electricidad, información, Oris/Éterium, Runas y procesos.

## Regla de datos

Supabase es la fuente de verdad. La V1 usa fixtures visuales solo para validar UX; no son canon. Cuando un dato no exista, mostrar `sin datos`, `experimental` o `pendiente`.

No duplicar reglas físicas, químicas, mágicas ni de simulación en React.

## Componentes visuales

La V1 debe evolucionar hacia componentes reutilizables:

- `FlowNode`
- `MetricCard`
- `MiniBarChart`
- `LineChart`
- `FormulaExplorer`
- `GenealogyGraph`
- `PropertyInspector`
- `CausalTrace`

Reutilizar `PropertyControl.tsx` para propiedades.

## Gráficos

Usar gráficos cuando expliquen una relación, evolución temporal, comparación de perfiles, genealogía, propagación o causalidad. No añadirlos como decoración.

## Partículas propias de Garlia

Las partículas son únicamente las fundamentales de Garlia: Masa, Cinética, Potencial, Información, Voluntad, Percepción, Transición, Ciclo, Entropía, Catálisis y Equilibrio.

No introducir protones/electrones/neutrones como parte del modelo interno.
