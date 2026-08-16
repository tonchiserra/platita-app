# Patrimonio contra las alternativas — Design

## Contexto

La página de Patrimonio (`/dashboard/patrimony`) muestra "Crecimiento del patrimonio": un area chart de `total_ars` por snapshot, con selector de rango (3M/6M/1A/3A/5A/Todo).

Ese gráfico responde *cómo evolucionó* tu patrimonio, pero no responde la pregunta que en Argentina importa más: **¿te convino?**. Un patrimonio que sube en pesos puede estar perdiendo contra la inflación, y puede haber rendido menos que la alternativa más obvia de todas, que es comprar dólares y guardarlos.

## Objetivo

Un gráfico nuevo que compare tu patrimonio real contra tres contrafácticos construidos sobre **la misma plata**: los mismos aportes, en el mismo momento, con otra estrategia.

## Las cuatro líneas

| Línea | Qué representa |
|---|---|
| **Tu patrimonio** | Lo que efectivamente pasó. Sale de `total_ars`. |
| **Si te dolarizabas** | Cada peso ahorrado se convirtió a dólares al blue de ese mes y quedó ahí. |
| **Empatar la inflación** | Lo que necesitarías para conservar exactamente el poder de compra. |
| **En el colchón** | Pesos nominales, quietos, sin rendir ni revaluarse. |

Se leen como una escalera. Dónde cae tu línea entre las otras tres dice cómo te fue:

- Arriba de inflación → ganaste poder de compra
- Entre inflación y colchón → le ganaste al colchón pero perdiste contra los precios
- Abajo del colchón → te fue peor que no hacer nada

Que la línea del dólar cruce a la de inflación en algunos tramos es información real, no un error: hay períodos donde el dólar le gana a los precios y períodos donde no.

## Cálculo

### La simetría

Las tres alternativas son **la misma operación con distinta unidad**: convertís cada peso que entra a una unidad, acumulás unidades, y revaluás al final.

| Línea | Unidad acumulada | Revaluación |
|---|---|---|
| En el colchón | pesos nominales | ninguna |
| Empatar inflación | pesos constantes (`c ÷ índice`) | × índice de hoy |
| Si te dolarizabas | dólares (`c ÷ blue`) | × blue de hoy |

Las tres salen como suma corrida, O(n):

```
colchón(i)     =           P₀ + Σⱼ≤ᵢ cⱼ
inflación(i)   = idxᵢ  × ( P₀/idx₀  + Σⱼ≤ᵢ cⱼ/idxⱼ  )
dolarizado(i)  = blueᵢ × ( P₀/blue₀ + Σⱼ≤ᵢ cⱼ/blueⱼ )
```

- `P₀` — patrimonio en el primer snapshot del rango (el ancla)
- `cⱼ` — ahorro neto del mes *j*: ingresos menos gastos, en ARS
- `idxᵢ` — índice de precios acumulado, `idx₀ = 1`, `idxᵢ = idxᵢ₋₁ × (1 + IPCᵢ/100)`
- `blueᵢ` — cotización del blue (venta) en la fecha del snapshot *i*

La línea real no se calcula: `total_ars` se congela al guardar el snapshot con las cotizaciones de ese día ([`SnapshotForm.tsx`](../../src/components/patrimony/SnapshotForm.tsx)), así que la serie histórica ya es honesta punto por punto.

### Granularidad mensual

Los flujos se agregan por mes en vez de convertirse en su fecha exacta. El IPC se publica mensual, así que precisión diaria en la línea de inflación sería falsa; las tres se alinean al input más grueso.

### Meses en rojo

Si los gastos superan los ingresos, `cⱼ` es negativo. El colchón resta; en la línea del dólar equivale a vender dólares a la cotización de ese mes. Sale natural de la fórmula y las líneas pueden bajar. **No se topa en cero** — sería mentir.

### Re-baseo por rango

Cambiar el rango recalcula todo desde el primer snapshot de la ventana, no desplaza el gráfico. Mirar 3M y mirar 5A dan contrafácticos distintos porque los aportes componen distinto.

### El supuesto

Las tres alternativas se construyen sobre los flujos registrados; la línea real incluye además cualquier movimiento que no se haya cargado. Va declarado como nota al pie del gráfico:

> Las alternativas se calculan sobre los ingresos y gastos que registraste.

Sin eso, un mes flojo de carga se disfraza de rendimiento.

## Estructura

| Archivo | Rol |
|---|---|
| `src/lib/utils/patrimony-alternatives.ts` | Función pura con la matemática. Isomórfica: corre en server y en cliente. |
| `src/components/patrimony/AlternativesChart.tsx` | Client component: selector de rango + `LineChart`. |
| `src/app/(dashboard)/dashboard/patrimony/page.tsx` | Trae los datos y arma la línea de tiempo. |
| `src/lib/api/exchange-rates.ts` | Repone `getDolarBlueHistory` y `blueRateOn`. |

### Flujo de datos

El server arma un arreglo compacto, una fila por snapshot:

```ts
interface TimelinePoint {
  date: string;           // fecha del snapshot
  patrimonyArs: number;   // total_ars, ya congelado
  netSavingsArs: number;  // ingresos − gastos desde el punto anterior
  blueRate?: number;      // blue venta en esa fecha
  inflationPct?: number;  // IPC del mes de esa fecha
}
```

El cliente recibe eso y corre la función pura sobre el tramo elegido. Se manda la línea de tiempo y no las series ya calculadas porque el re-baseo no es un corrimiento: cambiar el ancla cambia el resultado. Son ~50 filas, más liviano que mandar seis variantes precalculadas.

`getDolarBlueHistory` y `blueRateOn` se habían borrado al recortar los avisos de cotización, porque quedaron sin usuarios. Se reponen del historial.

### Presentación

Card nueva en la página de Patrimonio, debajo del gráfico de crecimiento. Se sigue el patrón del repo: `next/dynamic` + `LazySection`.

**Color.** Solo la línea del dólar lleva hue de moneda (`cur.usd`), porque es la única que *es* una moneda — así no se rompe la regla de que el color codifica moneda. Tu patrimonio va en tinta sólida y prominente; inflación y colchón en neutros, diferenciadas por patrón de guion.

**Tooltip.** Los cuatro valores de esa fecha más la diferencia contra tu línea, que es donde está el premio: *"vs. colchón +$ 12.400.000"*.

## Casos borde

- **Menos de 2 snapshots en el rango** → la card no se renderiza. No hay nada que comparar.
- **Sin serie del blue** → cae la línea del dólar, quedan las otras tres.
- **Sin IPC** → cae la línea de inflación.
- **IPC con atraso de publicación (~2 semanas)** → la línea de inflación corta en el último mes publicado en vez de extrapolar.
- El toggle de visibilidad de montos aplica al eje y al tooltip.

## Costo

Se necesitan todos los ingresos y gastos, no los últimos 12 meses, porque el rango "Todo" los usa. Se seleccionan solo `amount, currency, date`. La serie del blue son ~517 KB cacheados 6 h server-side.

## Tests

Script de función pura, mismo patrón que `alerts.ts`:

- las cuatro líneas arrancan iguales en el ancla
- sin ahorros, el colchón queda plano
- inflación en cero → inflación idéntica a colchón
- blue constante → dolarizado idéntico a colchón
- un ejemplo de tres meses calculado a mano
- un mes de ahorro negativo baja las líneas
- re-basear a un ancla posterior da otro resultado
- si falta el IPC del último mes, la línea corta ahí
