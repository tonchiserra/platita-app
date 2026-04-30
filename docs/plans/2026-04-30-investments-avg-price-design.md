# Precio promedio de compra en Inversiones — Design

## Contexto

La sección de Inversiones (`/dashboard/investments`) muestra una card "Resumen de Inversiones" con tres stats globales (Total invertido, Valor actual, Ganancia/Pérdida) más un bar chart con barras "Invertido" vs "Valor actual" por activo.

Hoy no se muestra el **precio promedio de compra** por activo, dato útil para comparar contra el precio actual y entender si una posición está en ganancia o pérdida.

## Objetivo

Agregar el precio promedio de compra a la card "Resumen de Inversiones", junto con un breakdown por activo en las stats existentes.

## Diseño

### Layout final de la card

```
Resumen de Inversiones

Total invertido      Valor actual          Ganancia/Pérdida          Precio prom. compra
US$ 1.200 (total)    US$ 1.299 (total)     +US$ 99 (+8.25%) total
US$ 1.000 (BTC)      US$ 1.083 (BTC)       +US$ 83 (+8.30%) BTC      US$ 60.000 (BTC)
US$ 200 (ETH)        US$ 216 (ETH)         +US$ 16 (+8.00%) ETH      US$ 2.500 (ETH)

[Bar chart Invertido vs Valor actual por activo — sin cambios]
```

Cada stat existente cambia de "un único valor combinado" a "valor total + una línea por activo". Se agrega una cuarta stat **Precio prom. compra** que solo tiene líneas por activo (no tiene total combinado porque no tiene sentido promediar precios entre activos distintos).

### Cálculos

- **Precio promedio de compra (por activo)** = `total invertido USD del activo / total unidades del activo`. Reusa el `byAsset` que ya existe en `investments/page.tsx`.
- **Precio actual** ya viene en `priceMap[asset]` (criptos via CoinGecko).
- **Ganancia/Pérdida por activo** = `currentValue - invested` y `(currentValue - invested) / invested * 100`.

### Reglas por stat

- **Total invertido**: total combinado + una línea por activo. Siempre presente para todos los activos.
- **Valor actual**: total combinado + una línea por activo. Si un activo no tiene `currentValue` (no-cripto), se omite su línea.
- **Ganancia/Pérdida**: total combinado + una línea por activo, solo para activos con `currentValue`. Color verde/rojo según signo (mantener comportamiento actual).
- **Precio prom. compra** (NUEVO): no muestra fila "total". Una línea por activo: `US$ X (ASSET)`.

### Orden

Los breakdowns por activo se ordenan por monto invertido descendente (el activo con más capital invertido aparece primero).

### Money visibility

El helper `mask()` del `MoneyVisibilityContext` se aplica a todos los valores numéricos (igual que hoy).

## Cambios en código

1. **`src/app/(dashboard)/dashboard/investments/page.tsx`**
   - Extender la estructura `byAsset` (o crear `assetSummary`) para incluir `invested`, `currentValue`, `units`, `avgPrice` por activo.
   - Pasar la nueva estructura al `InvestmentChart` como prop adicional.

2. **`src/components/investments/InvestmentChart.tsx`**
   - Refactorizar el bloque de stats globales (líneas 97-132) para que cada stat muestre total combinado + iteración sobre activos.
   - Agregar la cuarta stat "Precio prom. compra".
   - Aplicar el orden por monto invertido descendente.

3. **Sin cambios** en:
   - DB schema (no se agregan columnas — el avg price es un cálculo derivado).
   - Bar chart (las barras siguen siendo "Invertido vs Valor actual" por activo).
   - `InvestmentList` (la lista de transacciones individuales no cambia).

## Edge cases

- **0 inversiones**: la card no se renderiza (la condición `(investments ?? []).length > 0` en `page.tsx` ya lo cubre).
- **1 solo activo**: se muestra el "total" + 1 línea por activo (redundante pero consistente).
- **`units = 0`** para algún activo: se omite el avg price para ese activo (evitar división por cero).
- **Activo sin precio actual** (stocks, bonos, cedears, otros): solo muestra "Total invertido" y "Precio prom. compra"; las stats "Valor actual" y "Ganancia/Pérdida" no incluyen una línea para ese activo.
- **Money visibility off**: todos los valores se enmascaran con `mask()`.

## Out of scope

- No se cambia el bar chart.
- No se modifica `InvestmentList` ni la forma de cargar inversiones.
- No se agregan datos persistidos en la DB; el avg price es un cálculo derivado en runtime.
