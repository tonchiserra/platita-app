# Sincronización automática con BingX

## Qué se pidió

Que cada operación cerrada en BingX entre sola al libro de **Inversiones ›
Trading**, con su ganancia o pérdida, y que cada usuario configure su propia API
key.

Decisiones tomadas con el usuario (2026-11-21):

- **Solo perpetuos USDT-M** (y USDC-M, que usan los mismos endpoints). Futuros
  estándar, Coin-M y copy trading quedan afuera.
- **El resultado es el neto** (`netProfit`: PnL realizado más comisiones más
  funding). Es lo que realmente movió el saldo, así que el patrimonio estimado
  cierra con BingX.
- **Se sincroniza al abrir la app**, más un botón «Sincronizar». Nada de cron:
  un cron necesitaría la service role key, que saltea RLS, y en el plan Hobby
  corre como mucho una vez por día.

Segunda vuelta, el mismo día:

- **Nada que configurar en el servidor.** Platita la usan el usuario y dos
  amigos, y cada uno carga su key desde la app sin que nadie suba nada a Vercel.
  La primera versión cifraba con una variable `EXCHANGE_SECRET_KEY`; se
  reemplazó por Supabase Vault (ver «El secreto»).
- **Al conectar se pregunta qué sincronizar**: «A partir de ahora» o «Todas las
  operaciones».
- **El formulario lleva el instructivo**, deja claro que la key tiene que ser de
  **SOLO LECTURA y nada más**, y que Platita no se hace responsable si se carga
  una key con más permisos y se filtra. Una casilla «Entiendo» es obligatoria.

Las reglas del libro no cambian: las ganancias son ingreso, las pérdidas no son
gasto y solo bajan el patrimonio estimado. Lo único que cambia es cómo entran
las filas.

## Lo que dice la API, verificado con una key real

La documentación oficial (`bingx-api/docs-v3`, `bingx-api/api-ai-skills`) no
alcanza. Cada punto de esta lista se probó contra `open-api.bingx.com` con una
key de solo lectura:

- **`/openApi/swap/v2/trade/positionHistory` pide permiso de trading**
  (`100004 Permission denied … need Perpetual Futures Trading permission`),
  aunque la doc diga «Read». **La v1 (`/openApi/swap/v1/trade/positionHistory`)
  funciona con solo lectura** y es la que se usa. Parámetros: `symbol`
  (obligatorio, `109400` si falta), `startTs`, `endTs`, `pageIndex`, `pageSize`.
- **El rango filtra por hora de cierre** (`updateTime`). Una posición abierta el
  13 y cerrada el 20 no aparece al pedir del 14 al 15; sí aparece al pedir un
  rango que contiene el 20.
- **El rango máximo es de 90 días estrictos.** Con 100 días responde `109400
  the query range is more than ninety days`. Se usan ventanas de 89.
- **La paginación empieza en 0**, de la más nueva a la más vieja. Se pide hasta
  recibir una página incompleta. `pageSize` tiene un tope efectivo de 100.
- Campos de cada posición: `positionId`, `symbol`, `positionSide`
  (`LONG`/`SHORT` en modo hedge), `isolated`, `openTime`, `updateTime`
  (cierre), `avgPrice`, `avgClosePrice`, `realisedProfit` (así, con «s»),
  `netProfit`, `positionAmt` y `closePositionAmt` (**en unidades de la moneda**:
  `0.0158` BTC), `leverage`, `closeAllPositions`, `positionCommission` y
  `totalFunding`. Todos los números vienen como string, salvo el apalancamiento
  y los tiempos.
- `netProfit = realisedProfit + positionCommission + totalFunding`, al centavo.
- **Las liquidaciones no dejan un registro `REALIZED_PNL`** en
  `/openApi/swap/v2/user/income`, sino `INSURANCE_CLEAR`. Por eso los pares
  operados se descubren con el income **sin filtrar por tipo**. Si se filtrara
  por PnL, un par cuya única operación fue liquidada nunca se consultaría.
- **Cuánto historial guarda BingX:** `positionHistory` devolvió posiciones de
  hasta seis meses atrás (la más vieja, del 22 de mayo; antes, nada). El income
  y `allFillOrders` guardan **solo tres meses**. Ningún endpoint lista los pares
  más viejos, así que «todas» trae el historial completo de los pares operados
  en los últimos tres meses.
- `GET /openApi/v1/account/apiPermissions` devuelve `permissions` (1 spot,
  2 lectura, 3 futuros, 4 transferencias, 5 retiros, 7 sub-cuentas) e
  `ipAddresses`. En éxito manda el objeto sin `code`.
- Errores: siempre HTTP 200 con un `code`. Key inexistente `100413`; secret
  equivocado `100001`; sin permiso `100004`; IP fuera de la lista blanca
  `100419`; reloj desfasado `100421`; límite de pedidos `100410` (o HTTP 429 o
  418); parámetros `109400`.
- **BingX firma solo los parámetros, no la ruta**: HMAC-SHA256 de
  `k=v&k=v` ordenado por clave, sin codificar.

**No verificado:** qué manda `positionSide` en modo one-way (la cuenta de
prueba está en hedge). Si no es `LONG` ni `SHORT`, la dirección sale del signo
de `positionAmt`. El resultado, que es lo que importa, no depende de eso.

## Datos

Migraciones `005_exchange_connections.sql` y `006_exchange_vault.sql`.

`exchange_connections`, una fila por usuario y exchange:

| columna | |
|---|---|
| `user_id`, `exchange` | `unique (user_id, exchange)`. `exchange in ('bingx')` |
| `api_key` | en claro. Es un identificador; al navegador solo le llegan los últimos 4 caracteres |
| `secret_id` | el secret en Supabase Vault. Nunca se selecciona |
| `platform_id` | plataforma de Platita que se asigna a lo importado. `on delete set null` |
| `import_from` | se importan solo cierres posteriores: «ahora» o un año atrás |
| `synced_until` | cursor: fin del último período sincronizado con éxito |
| `last_sync_at` | último **intento** (con éxito o no) |
| `last_error` | el error de ese intento, en español, o `null` |

RLS igual que el resto (`(select auth.uid()) = user_id … to authenticated`), y
además privilegios por columna:
- `authenticated` **no puede insertar**: las filas nacen en `bingx_save_key`.
- Solo puede actualizar `platform_id`, `synced_until`, `last_sync_at` y
  `last_error`. Así nadie apunta su conexión al secret de otro.

`trades` suma `source` (`null` = manual, `'bingx'`) y `external_id` (el
`positionId`), con un índice único `(user_id, source, external_id)`. No es
parcial, porque `on conflict` de PostgREST no puede inferir uno parcial. Como
los nulos son distintos entre sí, las operaciones manuales nunca chocan.

### El secreto

El secret vive en **Supabase Vault**, cifrado por Supabase con una clave que no
está en la base. **Nunca sale de Postgres:**

- `bingx_save_key(api_key, api_secret, platform_id, import_from)`, `security
  definer`, crea o reemplaza el secret de *tu* conexión (`auth.uid()`).
  - Reemplazar la key conserva `import_from`, el cursor y la plataforma.
- `bingx_sign(payload)` devuelve **solo la firma** HMAC (pgcrypto), nunca el
  secret. Firma únicamente las dos lecturas que hace la sincronización:
  - income: `startTime`, `endTime` (+ `limit`);
  - historial de posiciones: `symbol`, `startTs`, `endTs` (+ `pageIndex`,
    `pageSize`).

  Esos nombres de parámetro no corresponden a ninguna orden, transferencia o
  retiro, y el `timestamp` tiene que estar a menos de 10 s de la hora actual.
  Una firma no sirve para otra cosa y vence enseguida.
- Un trigger borra el secret de Vault cuando se borra la conexión (desconectar o
  borrar la cuenta).

**Qué se resignó frente a la versión con variable de entorno:**
- Sin un secreto propio del servidor, la sesión del usuario puede lo mismo que
  el servidor. Un XSS en Platita podría pedir firmas de esas lecturas mientras
  corre. Con una key de solo lectura eso es, como mucho, leer el historial de
  BingX.
- Con una key con más permisos, una firma con los mismos parámetros podría
  aceptarse en un endpoint que cierra posiciones. Por eso las keys con más
  permisos se rechazan al conectar, y por eso el descargo de responsabilidad
  que pidió el usuario.

## Conectar (Ajustes › Trading › BingX)

El formulario trae, en este orden:

1. Un recuadro: «Usá una API Key de SOLO LECTURA y nada más», que Platita nunca
   opera, transfiere ni retira y rechaza keys con más permisos, y el descargo:
   no se hace responsable si se carga una key con más permisos (o se los agregan
   después en BingX) y se filtra.
2. El instructivo en cinco pasos: Gestión de API en la web de BingX, crear la
   API, **solo Lectura**, sin restricción de IP, copiar la API Key y la Secret
   (que BingX muestra una sola vez).
3. API Key, Secret Key y Plataforma (preseleccionada si hay una que se llame
   «BingX» o «Bing X»).
4. La pregunta **«¿Qué operaciones sincronizamos?»**, con dos tarjetas: «A
   partir de ahora» y «Todas las operaciones». No hay opción marcada: hay que
   elegir. Aclara que lo ya cargado a mano no se duplica.
5. La casilla «Entiendo que la key tiene que ser de solo lectura y que Platita
   no se hace responsable si tiene más permisos y se filtra». Es obligatoria.

`POST /api/bingx/connection` es la única escritura que no va por `useWrite`:

1. Verifica la sesión con `getClaims()`. Sin sesión, responde 401.
2. Valida la casilla y, si es una conexión nueva, la respuesta a la pregunta.
3. Prueba la key con `apiPermissions`, firmada **localmente** con el secret que
   todavía está en el pedido:
   - si BingX no la reconoce, responde con el error traducido;
   - **si tiene cualquier permiso además de lectura, la rechaza** sin guardarla;
   - si tiene IPs en lista blanca, la rechaza: las funciones de Vercel no tienen
     IP fija.
4. Llama a `bingx_save_key` con la sesión del usuario.
   - «A partir de ahora» guarda `import_from = ahora`.
   - «Todas» guarda `import_from = hace un año`.

Al terminar, el navegador sincroniza en el momento, sin esperar a la próxima
automática: con «todas» es cuando el historial tiene que aparecer.

Cambiar la plataforma y desconectar son un `update` y un `delete` vía
`useWrite`. Desconectar borra la fila y su secret; lo importado queda en el
libro.

## Sincronizar

`POST /api/bingx/sync` (`{ force?: boolean }`), con la sesión del usuario:

1. Sin conexión, responde `{ connected: false }`. Si el último intento fue hace
   menos de un minuto y no es `force`, responde `{ skipped: true }`.
2. **Período** (`syncWindows`, pura): desde `max(import_from, synced_until −
   1 h)` hasta ahora, nunca más de un año atrás, partido en ventanas de 89 días.
   - Una sincronización normal es una sola ventana.
   - La primera de «todas» son cinco.
   - La hora de solapamiento cubre a BingX si tarda en registrar una posición.
     El índice único hace que repetirla no duplique.
3. **Pares**: income del período, recortado a los tres meses que guarda BingX
   (`incomeWindow`), sin filtro de tipo. `limit=1000`, y se pagina moviendo
   `endTime` si vuelve lleno.
4. **Posiciones**: `positionHistory` v1 por par y por ventana, con las llamadas
   espaciadas 250 ms (5 por segundo por UID). Cada pedido lo firma
   `bingx_sign`.
5. **Filtro y conversión** (`positionToTrade`, pura):
   - entra solo si `closeAllPositions` es verdadero, el cierre cae en el período
     y es posterior a `import_from`, y `netProfit ≠ 0`;
   - `date` es la fecha del cierre en Buenos Aires y `asset` la base del par
     (`BTC-USDT` → `BTC`);
   - `direction` sale de `positionSide`, `pnl_usd` de `netProfit` y `leverage`
     del apalancamiento;
   - `pnl_pct = netProfit ÷ (avgPrice × closePositionAmt ÷ leverage) × 100`,
     redondeado a dos decimales;
   - `platform_id` viene de la conexión, `source = 'bingx'` y
     `external_id = positionId`.
6. **Lo cargado a mano no se duplica** (`dropManualDuplicates`, pura). Una
   operación manual tapa una posición si coinciden:
   - el mercado y la dirección;
   - la fecha, con un día de diferencia como mucho;
   - el resultado, dentro de US$ 0,05 o del 1 %.

   Cada fila manual tapa una sola posición, la más parecida primero.
   - Se calibró contra el libro real: las 28 posiciones de BingX de los últimos
     89 días tenían su gemela manual.
   - La mayor diferencia fue de US$ 0,07 sobre −US$ 1.849,93, y dos se habían
     cargado al día siguiente.
7. `upsert(..., { onConflict: "user_id,source,external_id", ignoreDuplicates:
   true })`. Lo que vuelve son solo las filas nuevas. La respuesta dice cuántas
   entraron y cuántas ya estaban cargadas a mano.
8. Con éxito, se guardan `synced_until = ahora`, `last_sync_at` y
   `last_error = null`. Con error se guardan `last_sync_at` y `last_error`, y
   **el cursor no avanza**.

### Disparo automático

`BingxAutoSync`, en el layout del dashboard, se monta solo si hay conexión:

- Sincroniza al abrir y al volver a la pestaña (`visibilitychange`). En el
  teléfono la app queda abierta en segundo plano y no se vuelve a montar.
- Lo hace solo si pasaron 10 minutos desde el último intento. La marca vive a
  nivel de módulo, así que el doble efecto de StrictMode no la dispara dos
  veces.
- Si entró algo, hace `router.refresh()`. Si falla no muestra nada: el error
  queda en Trading y en Ajustes.

## En Trading

- Arriba del libro hay una línea de estado («BingX · sincronizado hace 3 min»
  o el último error) con un botón «Sincronizar».
- Sin conexión, el libro vacío invita a conectar BingX en Ajustes.
- Las importadas llevan un badge «BingX». Al tocarlas, el resultado, la fecha,
  el mercado, la dirección, el apalancamiento y el % se muestran fijos; solo se
  editan notas y plataforma.
- **Las importadas no se borran**: la próxima sincronización las traería de
  vuelta por la hora de solapamiento.
- Ingresos, Inicio y Patrimonio no cambian: `tradeIncomes` y `tradeLossesUsd`
  ya leen todo el libro.

## Fuera de alcance

- Otros productos de BingX y otros exchanges. `exchange` ya es una columna con
  check, así que sumar uno es otra fila, no otra tabla.
- El respaldo exporta las importadas como operaciones comunes, sin la columna de
  origen.
- Pares que no se operaron en los últimos tres meses: BingX no tiene cómo
  listarlos, así que sus posiciones viejas no entran con «todas».

## Pruebas

- `scripts/bingx-sync.test.ts`:
  - firma: el payload canónico y la HMAC contra el ejemplo de la doc calculado
    con `openssl`;
  - ventanas: con cursor y sin cursor, «ahora» recién conectado, «todas» en
    cinco ventanas contiguas de menos de 90 días, el tope de un año y el
    recorte del income;
  - pares del income;
  - filtro y conversión: posición parcial, neto cero, cierre anterior a
    `import_from` o al período, fecha en Buenos Aires con un cierre a las 01:00
    UTC, y el % sobre el margen con la posición real;
  - duplicados manuales, con los pares reales del libro.
- En la base, dentro de una transacción revertida y con el rol `authenticated`:
  - la firma de `bingx_sign` coincide con la HMAC local;
  - se rechazan una orden, un timestamp viejo y un payload solo con timestamp;
  - se rechazan el `update` de `secret_id` y el insert directo.
- Prueba en seco de «todas» contra la cuenta real: 89 posiciones en un año,
  42 ya cargadas a mano.
- De punta a punta en la app, en el teléfono: conectar, cambiar la key,
  desconectar (borra el secret de Vault) y volver a conectar.
