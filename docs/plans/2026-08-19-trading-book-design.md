# Libro de operaciones de trading

## Qué se pidió

Un libro de operaciones dentro de Inversiones. Cada fila es el resultado de una
operación cerrada: fecha, moneda, tipo (Long o Short), PnL en USD, PnL en %,
apalancamiento y una nota.

Tres reglas dadas por el usuario, y son la especificación entera:

1. **Las ganancias se cuentan como ingreso, sin cargarlas a mano.** Hoy las carga
   como `incomes` con fuente `Investment Returns`; después de esta feature va a
   borrar esas filas y cargar cada operación en el libro.
2. **Las pérdidas no se cuentan como gasto.** Nunca. En ningún gráfico.
3. **Las pérdidas sí bajan el patrimonio estimado.** Hasta ahora no las cargaba,
   así que la estimación del mes siguiente venía inflada.

Y una cuarta, transversal: *«hay algunos gráficos que toman en cuenta los
retorno de inversión y otros que no, respetá eso»*.

Decisiones tomadas con el usuario:

- **«Moneda» es el activo operado** (BTC, ETH, SOL), no la moneda del PnL. El PnL
  siempre se carga en USD.
- **Dos pestañas en Inversiones**: `Cartera` (lo que ya existe) y `Trading` (el
  libro). Cartera no cambia en nada.

El resto quedó delegado, así que está resuelto acá y no vuelve a preguntarse: la
ecuación suma un solo renglón nuevo (el de pérdidas), `platform_id` queda, las
alertas no se tocan, y el gráfico de resultado por mes entra.

## La decisión de fondo: las ganancias no se guardan como ingresos

Había dos caminos para «se cuenta como ingreso sin cargarlo a mano»:

**Espejo** — el formulario del libro inserta en `trades` *y* en `incomes`.
**Derivado** — el libro es la única fuente; las ganancias se leen y se suman en
el momento de dibujar la página, como filas de ingreso sintéticas.

Va el derivado, y no por elegancia: sin transacciones multi-sentencia (todas las
escrituras salen del navegador con PostgREST, igual que en el respaldo de datos)
el espejo tiene cuatro lugares donde las dos mitades se desincronizan y nadie se
enteraría.

- Borrar una operación deja un ingreso huérfano.
- Editar el PnL deja el ingreso con el monto viejo.
- La importación del respaldo tendría que reconstruir el par sin duplicarlo.
- Un insert que falla a mitad deja una de las dos filas.

Con el derivado no hay par que mantener. Borrás la operación y su ingreso
desaparece porque nunca existió como fila.

### La forma de la fila sintética

```ts
{ date, amount: pnlUsd, currency: "USD", source: "Investment Returns",
  description: notes ?? `${direction} en ${asset}` }
```

`currency: "USD"` es la parte que hace que esto no requiera tocar ningún
agregador: cada página ya sabe convertir una fila de ingreso en USD con el tipo
de cambio que usa. Y `source: "Investment Returns"` significa que
`RETURN_SOURCES` —el filtro que ya existe en `src/lib/constants/sources.ts`—
excluye las ganancias del gráfico de alternativas **sin cambiar una línea de
`patrimony-alternatives.ts` ni de `patrimony-timeline.ts`**.

La regla que ya estaba escrita ahí sigue siendo cierta palabra por palabra: un
retorno es ingreso, pero no es plata nueva, así que el escenario «esto se
quedaba quieto» no puede acreditárselo.

El módulo nuevo es `src/lib/utils/trading.ts`, funciones puras sin imports de
`lib/api`, para que se puedan testear sin base ni red:

```ts
export function tradeIncomes(trades): TradeIncome[]              // pnl > 0
export function tradeLossesUsd(trades, month?): number           // |pnl| de pnl < 0, positivo
export function tradeProfitsUsd(trades, month?): number
export function tradeStats(trades, month?): TradeStats
export function tradePnlByMonth(trades): TradeMonth[]
```

`scripts/trading.test.ts` los cubre con 39 aserciones, incluidas las dos que
importan más: que `tradeIncomes` produce filas cuya fuente está en
`RETURN_SOURCES` —el mecanismo entero— y que una fila derivada, pasada por el
mismo filtro y el mismo `buildTimeline` que usa el gráfico de alternativas,
efectivamente no lo mueve. También el caso de PostgREST devolviendo los números
como texto, que es real en varios caminos de esta app.

## La tabla

```sql
create table trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  asset text not null,                          -- «moneda»: BTC, ETH, SOL
  direction text not null check (direction in ('long','short')),
  pnl_usd numeric(18,2) not null check (pnl_usd <> 0),
  pnl_pct numeric(10,2),                        -- con signo, sobre el margen
  leverage numeric(6,2),
  platform_id uuid references platforms(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
```

- **`pnl_usd` con signo, y `<> 0`.** Una operación de resultado cero no es un
  hecho que el libro tenga que registrar, y admitirla obligaría a cada consumidor
  a decidir de qué lado cae.
- **`asset` es texto libre**, por la misma razón que `expenses.category`:
  renombrar o dejar de operar un activo no puede reescribir la historia. No hay
  lista cerrada de monedas operables.
- **`direction` como check y no como enum**, para seguir a `platforms.type` y
  `investments.asset_type`, que también son checks.
- **`pnl_pct` y `leverage` opcionales.** El % depende del margen usado, que el
  libro no captura, así que no se puede derivar: se tipea o no está.
- **`platform_id` es agregado, no pedido, y queda.** Gastos, ingresos e
  inversiones lo tienen todos, y el patrimonio se desglosa por plataforma: sin
  él, una ganancia de trading no sabe en qué exchange cayó. Es opcional al cargar
  y se puede sacar después sin tocar nada más que el formulario y la hoja del
  respaldo.

Cuatro políticas de RLS y un índice `(user_id, date desc)`, igual que el resto.

## El signo es lo único que no se puede errar

Un menos olvidado convierte una pérdida en ingreso: la fila más peligrosa del
sistema. Así que el signo no se tipea.

El formulario tiene un selector **Ganancia / Pérdida** y un campo de monto
siempre positivo. El signo se compone al guardar. Debajo, el formulario dice de
antemano qué va a hacer con la fila:

- Ganancia → «Se va a contar como ingreso de US$ 420,00 en «Investment Returns»,
  con fecha 19/08/2026. No hace falta cargarlo a mano en Ingresos.»
- Pérdida → «No se carga como gasto. Baja tu patrimonio estimado en US$ 150,00 y
  no toca el resumen del mes.»

Ese texto es la feature entera dicha en voz alta en el momento en que importa.

## Quién cuenta qué

La lista completa, que es la respuesta a «respetá eso»:

| Consumidor | Ganancias | Pérdidas |
| --- | --- | --- |
| Resumen del mes (`MonthFlow`) | entra | se menciona, no se suma |
| Ingresos por fuente | entra | fuera |
| Tendencia de ingresos | entra | fuera |
| Flujo de caja | entra (serie de ingresos) | fuera |
| Gastos: categorías y tendencia | fuera | fuera |
| Patrimonio estimado y su ecuación | entra | **entra** |
| Alternativas del patrimonio | fuera | fuera |
| Cierres de patrimonio y desglose | fuera | fuera |
| Alertas | entra (vía ingresos) | fuera |
| Cartera: invertido vs. actual | fuera | fuera |
| Exportar e importar | entra | entra |

Dos filas merecen su explicación.

**Alternativas del patrimonio: las pérdidas quedan afuera por simetría.** Las
ganancias ya están excluidas porque el escenario contrafáctico no las habría
tenido. Por lo mismo, no las habría sufrido: el colchón de pesos no se liquida.
En la práctica esto se implementa **no haciendo nada** — las pérdidas nunca
entran a `flows[]`, así que las cuatro líneas alternativas siguen construidas
sobre los mismos aportes que hoy.

**Alertas: entran como ya entraban, y se dejan así.** `buildAlerts` recibe
`incomesByMonth`, que ya incluía las filas manuales de `Investment Returns`.
Inyectar las sintéticas mantiene el comportamiento actual, que es exactamente lo
que se pidió respetar.

Queda anotado el riesgo, con su disparador: con el libro completo el ingreso
mensual se vuelve más irregular, así que `incomeBelowAverage` puede empezar a
sonar por un mes flojo de trading en vez de por el sueldo. **Si esa alerta
aparece dos meses seguidos sin que el sueldo haya bajado**, el arreglo es de una
línea: pasarle a `buildAlerts` un `incomesByMonth` construido sin fuentes de
retorno. No se hace por adelantado porque es cambiar la semántica de una alerta
para prevenir un problema que todavía no pasó.

No se agrega ninguna regla nueva de alerta. Una racha de pérdidas es un mes
ordinario para quien opera, y la disciplina de `T` en `alerts.ts` es que una
alerta que suena todos los meses es ruido.

## Las pérdidas y la estimación

La estimación pasa a ser:

```
patrimonio estimado = último cierre revaluado
                    + ingresos del mes        (ya incluye ganancias de trading)
                    − gastos del mes
                    − pérdidas de trading del mes
```

Dos lugares:

- `dashboard/page.tsx`: `estimatedArs += totalIncomes - totalExpenses - tradingLossesArs`
- `patrimony/page.tsx`: `monthNet = ingresos − gastos − pérdidas`

Es coherente en las dos direcciones. El cierre de julio contó el saldo del
exchange; en agosto una ganancia de US$ 200 lo sube y una pérdida de US$ 150 lo
baja, y la estimación se mueve igual. Lo que entra al patrimonio es el neto.

### El hueco del resumen del mes

Acá aparece la única arruga real del modelo pedido. «Entró» incluye las
ganancias (son ingreso) y «Salió» son sólo gastos (la pérdida no es gasto).
Entonces «Te quedó» deja de explicar todo el movimiento del patrimonio, y la
diferencia es exactamente la pérdida de trading.

No se puede resolver sin romper una de las tres reglas, así que se nombra en vez
de esconderse: un pie de tarjeta, sólo en los meses con pérdidas.

> Además, **$ 259.055** de pérdidas de trading *(US$ 197,00)*. No cuentan como
> gasto, pero bajan tu patrimonio estimado.

No es una cuarta cifra al lado de las otras tres: es un pie, tipografía chica,
debajo de la barra. Las pérdidas no son un flujo del mismo rango que los
ingresos y los gastos, y la jerarquía tiene que decirlo.

### La ecuación

`PatrimonyEquation` suma **un** renglón nuevo:

```
  6.180.000        ARS
+ 4.250      USD × 1.315
+ 0,02400000 BTC × 112.400 USD × 1.315
+ 4.528.655        ingresos de agosto            ← ya incluye las ganancias
− 1.740.000        gastos de agosto
− 259.055          pérdidas de trading de agosto  ← lo único nuevo
```

Se evaluó desglosar el trading en dos renglones propios —ingresos sin trading,
ganancias de trading, gastos, pérdidas de trading— y quedaba más auditable de un
vistazo. Se descartó: con esa forma ningún renglón coincide con «Entró en agosto»
del resumen del mes, y hay que sumar dos a ojo para reconciliarlos. La ecuación
existe para reproducir la cuenta que el usuario ya vio arriba; su valor se cae si
sus números no atan con los de la tarjeta de al lado.

El renglón de pérdidas no se destaca con color ni con peso. La ecuación es
uniforme y tiene que seguir siéndolo: si un renglón grita, deja de leerse como
aritmética.

## Rutas, no estado de cliente

Las pestañas son dos rutas, no un `useState`:

```
src/app/(dashboard)/dashboard/investments/layout.tsx   ← la barra de pestañas
src/app/(dashboard)/dashboard/investments/page.tsx     ← Cartera (lo de hoy)
src/app/(dashboard)/dashboard/investments/trading/page.tsx  ← el libro
```

Las dos páginas son Server Components y cada una pide sólo lo suyo: Trading no
paga la llamada a CoinGecko de `getCryptoPriceMap()`, Cartera no lee `trades`.
Un estado de cliente obligaría a traer los dos conjuntos de datos siempre.

La barra es un segmented control sobre `bg.sunk` con la pestaña activa en
`bg.card` + borde: el mismo idioma que el `ViewToggle` de `BreakdownPanel`. No se
introduce `Tabs` de Chakra v3 — la app no lo usa en ningún lado.

`navigation.tsx` no cambia. El pedido fue «dentro del apartado de inversiones».

## Vocabulario visual

- **Long / Short: chip neutro con flecha**, borde `border.input`, texto
  `fg.body`. Nunca `trend.up` / `trend.down`: esos colores son dirección del
  *resultado*. Un Short ganador pintado de rojo sería una mentira de color.
- **El PnL sí usa `trend.up` / `trend.down`**, que es exactamente para lo que
  están.
- **La chapa del activo copia la de `InvestmentList`**: `brand.100` / `brand.700`
  uniforme, no un hue por moneda. `cur.btc` y `cur.eth` codifican *tenencias* en
  esa moneda; un mercado operado no es una tenencia, y de todas formas SOL no
  tiene token. (Nota al margen: esa chapa usa `brand.100`/`brand.700` literales,
  no semánticos, así que en modo oscuro queda celeste sobre fondo oscuro. Es así
  hoy en `InvestmentList`; se reproduce igual y no se arregla de contrabando.)
- **La tira de números** copia el `Fig` de `MonthFlow` al detalle: etiqueta 2xs
  mayúscula con `letterSpacing 0.13em`, cifra Archivo 2xl con
  `fontVariationSettings: '"wdth" 106'`.
- **Todo en USD en la pestaña Trading**, como el resto de Inversiones. Es la única
  página que no normaliza a pesos, y el PnL ya viene en dólares.

Tres cifras en la tira, no más: resultado del mes, tasa de acierto, resultado
acumulado. Sin `% vs. mes anterior` — dividir un PnL por otro que puede ser
negativo da un número sin significado.

## Respaldo e importación

Hoja nueva `Trading` en `backup-schema.ts`, con columnas `fecha`, `activo`,
`tipo`, `PnL USD`, `PnL %`, `apalancamiento`, `plataforma`, `notas`. Toca
`SHEET`, `COLUMNS`, `SHEET_ORDER`, `BackupData`, `emptyBackup()`, `countRows()`,
`parseBackupWorkbook()` y el orden de borrado/inserción de `DataTransfer`.

No es opcional: la importación **reemplaza**, así que una hoja ausente borraría
el libro entero sin decir nada. Es el mismo razonamiento que ya está escrito en
el doc del respaldo.

`trades` es `on delete set null` sobre `platforms`, así que va en el mismo grupo
que gastos, ingresos e inversiones: se borra antes de las plataformas y se
inserta después.

## La migración puede no estar aplicada

`002_expense_categories.sql` todavía no está aplicada en el proyecto del usuario.
`003_trades.sql` va a estar en la misma situación entre que se escribe y se
corre, así que todo camino de lectura tiene que tolerar que la tabla no exista:

- Las páginas ya son seguras: `trades ?? []` cuando el query falla. Sin trades,
  todo queda como hoy.
- La exportación tolera el código `42P01` como «sin filas», igual que hace con
  `expense_categories`.

## Migrar los ingresos viejos

El usuario va a borrar sus filas de `Investment Returns` y cargarlas como
operaciones. Dos cosas que van a cambiar de número y conviene saberlas antes:

- **Las ganancias históricas se reexpresan al blue de hoy** en las tendencias del
  dashboard y de ingresos, porque esas páginas convierten todo USD con el tipo de
  cambio actual. No es nuevo ni exclusivo del trading: le pasa hoy a cualquier
  ingreso en USD. Pero una fila que estaba en pesos y pasa a estar en dólares
  cambia de valor histórico.
- **El gráfico de alternativas no se mueve**, porque esas filas ya estaban
  excluidas por `RETURN_SOURCES`. Es la mejor señal de que el modelo es el
  correcto: la migración es invisible justo donde tiene que serlo.

## El gráfico de resultado por mes

Entra, aunque no se pidió. Es la única pregunta que el libro no contesta de un
vistazo: la forma de la racha. Tres meses buenos seguidos y uno malo se ven en el
gráfico; en una lista de filas hay que sumarlos a ojo.

Barras con signo, no línea acumulada. Una acumulada sube siempre que el neto sea
positivo, así que esconde justo los meses que importan. El acumulado ya está como
número en la tira de arriba del libro.

El eje no se recorta simétrico alrededor del cero: el peor mes es chico contra el
mejor, y forzar la simetría gastaría media altura en blanco. Es la misma decisión
que ya está tomada en `AlternativesChart`, cuyo eje tampoco arranca en cero.

Va con `next/dynamic` + `LazySection`, como todo Recharts en la app.

### Dos trampas que costaron un gráfico en blanco

La primera versión no se veía, por dos razones que conviene dejar escritas:

1. **Altura explícita en px, no `flex="1"` + `height="100%"`.** Esta tarjeta es
   hija directa de un `VStack` y no tiene altura propia, así que un contenedor
   con `flex-basis: 0` al que `ResponsiveContainer` le pide el 100 % mide cero y
   el gráfico sale vacío. `ExpenseTrendChart` se salva porque vive en un
   `SimpleGrid` con `h="full"`. El precedente correcto para un gráfico suelto es
   `CashflowChart`, que fija su plot en píxeles — y ahora este también.
2. **Recharts toma un `radius` por serie, no por celda.** Una única serie con
   signo redondea la punta *de arriba* de una barra que crece hacia abajo. Van
   dos series, `up` y `down`, con `stackId` compartido y `null` en la que no
   corresponde: queda una sola barra por mes, centrada, y cada dirección con su
   propio redondeo.

Y una trampa de verificación, no de código: un screenshot de página completa
redimensiona el viewport, `ResponsiveContainer` lo detecta y **reinicia la
animación de las barras**, así que la captura sale con las barras en altura cero
y parece un gráfico roto. Para mirar este gráfico hay que capturar el viewport,
no la página entera.

Se dibuja desde el primer mes, no desde el segundo. Una sola barra es flaca
—acotada con `maxBarSize` para que no cruce la tarjeta— pero un gráfico que
directamente no está se lee como una función que no funciona.

## Fuera de alcance

- Operaciones abiertas, precio de entrada y salida, tamaño de posición,
  comisiones. El pedido es un libro de resultados cerrados, no un diario de
  trading.
- Reglas de alerta propias de trading.
- Arreglar la chapa `brand.100` en modo oscuro de `InvestmentList`.
