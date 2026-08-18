# Exportar, plantilla e importar datos

## Qué se pidió

Tres botones en Ajustes: exportar datos, descargar plantilla, importar datos
usando la plantilla descargada.

Decisiones tomadas con el usuario:

- **Formato**: un único `.xlsx` con una hoja por tabla. Exportación, plantilla e
  importación comparten exactamente la misma forma, así que lo exportado se
  puede volver a importar sin tocarlo.
- **Alcance**: todo, incluidos los cierres de patrimonio.
- **Importación**: reemplaza. Borra lo que hay y deja únicamente lo del archivo.

## Por qué un libro de Excel y no CSV

El CSV parecía más liviano hasta mirar el ida y vuelta. Excel en es-AR escribe
`;` como separador y coma decimal, así que un CSV exportado, abierto, editado y
vuelto a guardar puede dejar de parsearse — y el usuario no tiene forma de
saberlo hasta que la importación falla. En `.xlsx` los números y las fechas
viajan tipados, así que ese problema no existe.

Además son siete tablas. En CSV eso obliga a varios archivos (o un zip) o a un
único archivo con una columna `tipo` y la unión de todas las columnas, que deja
la planilla ancha y con la mayoría de las celdas vacías en cada fila. Una hoja
por tabla es lo que un usuario espera encontrar.

Librerías: `write-excel-file` y `read-excel-file`. `xlsx` (SheetJS) está
abandonado en npm desde 2022 y `exceljs` desde 2023; estas dos siguen
publicando en 2026 y no arrastran ninguna vulnerabilidad conocida. Se cargan
con `import()` diferido, así que no entran al bundle inicial de Ajustes.

## El riesgo real: no hay transacciones

Todas las escrituras salen del navegador con el cliente de Supabase. PostgREST
no ofrece transacciones multi-sentencia, así que un "reemplazar todo" que borre
y después falle a mitad de la inserción deja al usuario sin datos y sin forma de
volver atrás.

Tres medidas, en este orden:

1. **Validar el archivo completo antes de borrar nada.** Se parsean y validan
   todas las filas, se resuelven todas las referencias por nombre y se arman
   todos los payloads en memoria. Si algo falla, no se toca la base.
2. **Bajar un respaldo automático justo antes de borrar.** Es la misma
   exportación, disparada sola. Si la restauración se corta por la mitad, el
   usuario tiene en su carpeta de descargas el estado anterior exacto.
3. **Confirmación explícita** con el recuento de lo que se va a borrar y de lo
   que se va a insertar.

No elimina el riesgo — lo acota a "se cortó, tenés el archivo de antes".

## Orden de las operaciones

El esquema obliga a un orden concreto:

- `patrimony_snapshot_items.snapshot_id` es `on delete cascade`, así que borrar
  los cierres se lleva el detalle.
- `patrimony_snapshot_items.platform_id` **también** es `on delete cascade`:
  borrar una plataforma borra el detalle que la referencia.
- Los movimientos son `on delete set null`, ahí no se cascadea.

**Borrado**: cierres (arrastra el detalle) → gastos, ingresos, inversiones →
categorías → plataformas.

**Inserción**: plataformas (hacen falta sus ids nuevos) → categorías →
movimientos (resuelven plataforma por nombre) → cierres (hacen falta sus ids)
→ detalle de cierres (necesita id de cierre y de plataforma).

## Referencias por nombre, no por id

La plantilla no puede pedirle al usuario que escriba UUIDs. Las plataformas se
referencian por **nombre**, y la importación resuelve nombre → id con las
plataformas que acaba de insertar. Un nombre que no esté en la hoja
`Plataformas` es un error de validación, no un `null` silencioso.

Esto vale también para el detalle de cierres, que se ata a su cierre por
**fecha**: `patrimony_snapshot_items.platform_id` es `not null`, así que ahí un
nombre sin resolver no puede degradar a nada.

## Valores tal como los guarda la base

`expenses.category` e `incomes.source` se guardan en inglés (`Food`, `Salary`) y
la app no tiene capa de traducción: los muestra así. La plantilla usa los mismos
valores en lugar de inventar un español que el resto de la app no tiene.

Para `platforms.type` y `investments.asset_type` sí existe `PLATFORM_TYPE_LABELS`,
así que la importación acepta la etiqueta en español además de la clave, pero
exporta la clave. La hoja `Instrucciones` lista los valores válidos.

## `units` es derivado

En el formulario de inversiones `units` se calcula como
`total_amount / price_per_unit`. La exportación incluye las tres columnas para
que el ida y vuelta sea fiel, y la importación deriva `units` cuando la celda
viene vacía, igual que el formulario.

## Categorías sin migración 002

La migración `002_expense_categories.sql` puede no estar aplicada. La
exportación trata el error de tabla inexistente como "sin filas" y la
importación avisa en lugar de fallar, igual que `resolveCategories()` cae a las
categorías por defecto.

## Una exportación parcial nunca puede pasar desapercibida

La primera versión leía las seis consultas y solo revisaba el error de una. Si
la de gastos fallaba, `data` venía `null`, se escribía la hoja vacía y el
archivo salía con plataformas y categorías llenas y el resto en blanco, sin
ningún aviso. Peor: restaurar desde ese archivo habría borrado los gastos
reales, porque una hoja vacía significa "no tenés gastos".

Tres cambios:

1. **Toda consulta que falle corta la exportación** con un mensaje que nombra la
   tabla y el motivo. La única excepción tolerada es `expense_categories` con
   código `42P01`, que es el caso de la migración 002 sin aplicar.
2. **Todas las tablas se leen paginadas** con `.range()`. Sin eso, un proyecto
   con `db-max-rows` configurado devuelve la primera página y nada lo indica.
   El detalle de los cierres dejó de leerse anidado bajo los cierres por la
   misma razón: un select anidado tiene su propio tope.
3. **El aviso de éxito lista las siete hojas con su cantidad**, incluidas las que
   dieron cero. Un "0 gastos" a la vista es un problema visible; un total
   agregado lo escondía.

El paginado y el manejo de errores viven en `fetchAllPages()`, en
`backup-schema.ts`, con el lector de páginas inyectado. Estaban dentro del
componente, donde ningún test los alcanzaba — que es la razón por la que el
defecto se escapó. Ahora tienen doce tests, incluido el caso de una tabla con
un múltiplo exacto del tamaño de página, que es donde un paginador ingenuo
trunca.

## Lectura por encabezado

Las columnas se leen buscando el **nombre del encabezado**, no por posición. Un
usuario que reordene o agregue columnas en la planilla no rompe la importación.
