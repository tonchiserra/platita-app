# Refactor completo con el design system de COSRX AR — Diseño

## Contexto

Se rehace toda la app. Lo único que se conserva es la base de datos y sus datos.
Pedidos:

- Que deje de ser lenta, revisando también la base.
- Adoptar el UI Kit de COSRX AR que armó Innovate (`~/Desktop/Innovate/cosrx-theme`:
  `snippets/ui-kit-tokens.liquid`, `docs/theme-plan/ui-kit.md` y el handoff
  `docs/design/handoff/2026-10-20-completo`).
- Menos gráficos, pero que digan algo. Se quedan seis:
  1. Barras de ingresos por mes.
  2. Barras de gastos por mes.
  3. Barras de ingresos vs. gastos.
  4. Crecimiento de capital (cierres de patrimonio más el estimado del mes abierto).
  5. Sobre el 4: la opción de compararlo con «si me dolarizaba».
  6. Torta de gastos por categoría, mes a mes.
- Mantener las cotizaciones y el apartado de trading. Mejorar inversiones.

Decisiones tomadas con el usuario (2026-11-20):

| Tema | Decisión |
|---|---|
| Fuentes | Equivalentes libres: Maison Neue, Maison Neue Extended y Piek son pagas y su licencia es del cliente. |
| Inversiones | Las cuatro mejoras: posiciones claras, ventas, precio de CEDEARs/acciones/bonos y rendimiento en el tiempo (un séptimo gráfico). |
| Moneda de los gráficos | Primero un selector ARS / USD; después (2026-11-20) **todo en pesos, sin selector**, salvo Trading, que va siempre en dólares. |
| Se quedan | Modo oscuro y la ecuación del patrimonio estimado. |
| Se va | El panel de alertas («Para tener en cuenta») y el resto de los gráficos actuales. |

## 1. Por qué es lenta (diagnóstico)

1. **JavaScript en el cliente.** Chakra UI v3 genera CSS en tiempo de ejecución con Emotion,
   y Recharts pesa ~295 KB. En un celular de gama media, eso es lo que más tarda en hidratar
   y en responder después de cada `router.refresh()`.
2. **RLS por fila.** Las 32 policies usan `auth.uid() = user_id`, y Postgres evalúa
   `auth.uid()` en cada fila. La forma recomendada por Supabase, `(select auth.uid())`,
   se evalúa una sola vez por consulta (*initPlan*). Las policies tampoco declaran
   `to authenticated`, así que se evalúan también para `anon`.
3. **Ítems de cierre sin índice.** `patrimony_snapshot_items` no tiene índice en
   `snapshot_id`. Su policy es un `exists` correlacionado contra `patrimony_snapshots`, así que
   leer los ítems recorre la tabla una vez por fila. Tampoco hay índice en ninguna `platform_id`.
4. **Consultas anchas.** Varias páginas piden `*` con joins que después no usan.
5. **Región (la causa principal).** La base estaba en Oregon (`us-west-2`), y cada consulta desde
   Argentina tardaba ~250 ms. El 2026-11-20 se migró a São Paulo (`sa-east-1`): volcado completo,
   restauración verificada fila por fila y por sumas, y el proyecto viejo quedó pausado como respaldo.
   Desde acá, una consulta pasó a 55–100 ms. Las funciones de Vercel quedan fijadas en `gru1` con
   `vercel.json`, al lado de la base.

## 2. Arquitectura

- **Se mantiene:** Next 16 (App Router), React 19 con React Compiler, Supabase (Auth + Postgres),
  TypeScript estricto y `getClaims()` en el servidor.
- **Se va:** `@chakra-ui/react`, `@emotion/react` y `recharts`.
- **CSS:** tokens globales en `src/styles/tokens.css` (copiados del UI Kit con sus nombres)
  y CSS Modules por componente. No hay CSS en tiempo de ejecución.
- **Gráficos:** SVG propio. El servidor calcula las series y el cliente solo dibuja y maneja el
  tooltip y el selector ARS/USD. No usa librería.
- **Lectura:** las páginas son Server Components. Las consultas viven en `src/lib/data/*`, con
  columnas explícitas y filtro `.eq("user_id", …)`. Cada bloque lento (series históricas,
  precios) va en su propio `<Suspense>`, para que la cifra principal aparezca sin esperarlos.
- **Escritura:** sigue siendo desde el navegador con el cliente de Supabase (es un solo salto
  a la base) y después `router.refresh()` dentro de `startTransition`.
- **Modo oscuro:** `next-themes` (`attribute="class"`). La paleta oscura se deriva del DS:
  el negro de marca pasa a ser el fondo y el amarillo sigue siendo el acento.

## 3. Lenguaje visual (adaptación del UI Kit de COSRX AR)

**Color**: los tokens van tal cual el UI Kit.

- `--color-negro` #231F20: texto y botón primario. `--color-blanco`: fondo.
- `--color-amarillo` #FFF101: acción destacada (el botón «+ Cargar» y la serie resaltada).
  Nunca como fondo de un bloque grande.
- `--color-gris-producto` #F3F2EF: fondo de bloques y cards (`--bloque-fondo`).
- Grises de apoyo, `--color-borde` #E6E6E3 y `--color-borde-fuerte` #CFCDCA.
- `--color-error` #D6272E: solo errores. Para pérdidas se agrega `--color-baja` (otro rojo)
  y para ganancias `--color-suba` (verde oscuro). Son una extensión que el DS no tiene,
  y una app de finanzas la necesita. Siempre van con ▲/▼ y nunca solo con color.

**Tipografía** (equivalentes libres, elegidos comparándolos con las originales):

| Rol en el UI Kit | Original | Acá |
|---|---|---|
| Texto, botones, UI (`--font-texto`) | Maison Neue | **Hanken Grotesk** (dígitos tabulares) |
| Titulares h1/h2 (`--font-display`) | Maison Neue Extended Book | **Mona Sans** con `font-stretch: 125%` |
| Cifras grandes y etiquetas `[/ … /]` (`--font-acento`) | Piek Light | **Aleo Light** |

Se sirven con `next/font/google` (se alojan en el propio dominio, sin pedidos a Google).

**Forma**: la regla del kit es recto para la estructura y redondeado para lo que se toca o flota.
Botones, chips, inputs y el control segmentado en píldora; cards en 10 px; cucardas en 4 px.

**Movimiento**: .15 s para la opacidad, .25 s para transform y .3 s para fondos.
Los bloques aparecen con *reveal* al entrar. Todo respeta `prefers-reduced-motion`.

**Íconos**: SVG inline de 22 px, `stroke-width 1.6` y extremos redondeados, como el kit.

## 4. Pantallas

Navegación mobile-first. Abajo hay una barra con Inicio, Gastos, Ingresos, Patrimonio e
Inversiones, y Ajustes se abre desde el header. El botón amarillo «+» abre una hoja para cargar
un gasto o un ingreso desde cualquier pantalla. En desktop hay una barra lateral.

- **Inicio**:
  - Patrimonio estimado en ARS y USD, con la ecuación desplegable.
  - El mes en curso: entró, salió y quedó.
  - Gráfico 3, ingresos vs. gastos.
  - Gráfico 4/5, crecimiento de capital con «vs. dolarizado».
  - Cotizaciones.
- **Gastos**: total del mes, gráfico 2, gráfico 6 (con selector de mes ‹ ›) y la lista por mes.
- **Ingresos**: total del mes, gráfico 1 y la lista por mes.
- **Patrimonio**: cifra actual, gráfico 4/5, carga de cierre y tabla de cierres.
- **Inversiones**:
  - Cartera: resumen, gráfico 7 (rendimiento), posiciones, compras/ventas y precios manuales.
  - Trading: el libro de operaciones, igual que hoy pero con el lenguaje nuevo.
- **Ajustes**: cuenta, apariencia (claro/oscuro/sistema), ocultar montos, plataformas,
  categorías y datos (exportar/importar).

Todas las cifras clave muestran ARS y USD juntos. Los montos siguen pasando por `mask()`.

## 5. Gráficos y moneda

**Todos los gráficos van en pesos y no hay selector de moneda** (el usuario pidió sacarlo).
Las cifras clave siguen mostrando el valor en USD como dato secundario.

- **Pesos nominales**: un movimiento en USD vale los pesos que valía ese día (blue de su fecha).
- **Trading va siempre en dólares**, que es la unidad en la que se cargan los resultados,
  y nunca se pasa a pesos.
- Inversiones muestra pesos primero (al blue de hoy) y dólares abajo. Las tarjetas de posición
  quedan en USD, porque el costo y el precio por unidad son cotizaciones en dólares.
- EUR y cripto no tienen serie histórica acá: usan la cotización de hoy.
- **Crecimiento de capital**:
  - En ARS es el `total_ars` de cada cierre. En USD es ese total dividido por el blue
    del día del cierre.
  - El mes abierto usa el estimado (`flowsSinceClose`), con línea punteada.
- **Dolarizado**: el ancla es el patrimonio del primer mes con movimientos, pasado a dólares,
  más cada mes de ahorro (ingresos − gastos, sin `RETURN_SOURCES`) pasado a dólares a su blue.
  Es la lógica de `buildAlternatives` (que sigue calculando las otras líneas; solo se dibuja esta).
- El eje Y no arranca en cero en los gráficos de línea (`axisScale`). En los de barras, sí.

## 6. Inversiones

**Modelo**:

- `investments.side` (`buy` | `sell`) se agrega con la migración. Las filas existentes quedan
  como compra.
- Las posiciones se calculan por activo (nombre normalizado) con **costo promedio** en USD.
- Una venta baja las unidades. La ganancia realizada es lo que entró por la venta menos el
  costo promedio de las unidades vendidas.
- El costo de una operación en ARS se pasa a USD con el blue de **su fecha**. Hoy usa el
  de hoy, y además la página solo leía las últimas 50 filas.

**Precio actual** (todo pasa a USD):

| Tipo | Fuente |
|---|---|
| Cripto | Binance (`data-api.binance.vision`, par `<ACTIVO>USDT`; las stablecoins valen 1). Si falla, CoinGecko. |
| CEDEAR y acción | data912 (`/live/arg_cedears`, `/live/arg_stocks`), precio en ARS ÷ blue de hoy. |
| Bono / ON / letra | data912 (`/live/arg_bonds`, `arg_corp`, `arg_notes`), que cotiza cada 100 nominales. |
| Otro, o sin cotización | Precio manual: la tabla nueva `asset_prices` (por usuario y activo). |

Un precio manual pisa al automático. Lo que no tiene precio queda como «Sin precio» y no suma
resultado.

**Gráfico 7, rendimiento**: va mes a mes desde la primera operación y compara dos series.

- Capital invertido neto: compras menos lo que entró por ventas, en USD.
- Valor de mercado a fin de mes: unidades × precio de cierre del mes.
- Los precios históricos salen de Binance (velas mensuales) y de data912 (`/historical/*`).
- Un activo sin histórico se valúa al costo.

## 7. Base de datos — migración `004_performance_and_investments.sql`

Se aplica a mano en el SQL editor de Supabase. No borra ni reescribe datos.

1. Recrea las 32 policies con `(select auth.uid())` y `to authenticated`. Las de
   `patrimony_snapshot_items` pasan a `snapshot_id in (select id … where user_id = (select auth.uid()))`.
2. Índices nuevos:
   - `patrimony_snapshot_items(snapshot_id)` y `(platform_id)`.
   - `platform_id` en `expenses`, `incomes`, `investments` y `trades`.
   - `investments(user_id, asset)`.
3. `investments.side text not null default 'buy' check (side in ('buy','sell'))`.
4. Tabla `asset_prices` (`user_id`, `asset`, `price`, `currency`, `updated_at`,
   `unique(user_id, asset)`) con RLS.
5. `analyze` de las tablas tocadas.

El código no se rompe antes de aplicarla:

- `investments` se lee con `*` y una fila sin `side` es una compra.
- Si `asset_prices` no existe (PGRST205), se toma como vacía.
- Cargar una venta antes de la migración sí falla, y se avisa en pantalla.

## 8. Lo que se conserva del código actual

Las utilidades puras con tests se conservan: `patrimony-estimate`, `patrimony-timeline`,
`patrimony-alternatives`, `trading`, `chart-scale`, `backup-schema`,
`format` y `expense-categories`. El resto se reescribe. Se borran `alerts.ts` y la serie de CPI
de EE.UU. (BLS), porque solo la usaban las líneas que se van.

Las categorías y fuentes por defecto se siguen guardando con su nombre actual en inglés: la base
no cambia. Solo se agregan etiquetas en español para mostrarlas.
