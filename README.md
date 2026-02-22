# Platita

App de finanzas personales para trackear gastos, ingresos, inversiones y patrimonio.

## Tech Stack

- **Next.js 16** (App Router) + **React 19**
- **Supabase** (Auth + PostgreSQL + RLS)
- **Chakra UI v3** + **next-themes**
- **Recharts** (gráficos de patrimonio e inversiones)

## Features

- Dashboard con resumen de patrimonio, gastos, ingresos y balance mensual
- Registro de gastos por categoría con agrupación mensual
- Registro de ingresos con agrupación mensual
- Inversiones con chart comparativo (invertido vs valor actual)
- Snapshots de patrimonio con detalle por plataforma y moneda
- Gráfico de crecimiento de patrimonio (1M, 3M, 6M, 1A, Todo)
- Cotizaciones en tiempo real (Dólar Blue, MEP, CCL, BTC, ETH)
- Toggle de visibilidad de montos (ojo) con persistencia en localStorage
- Tema claro/oscuro
- Auth con Supabase (login/registro)

## Setup

1. Clonar el repo e instalar dependencias:

```bash
npm install
```

2. Crear `.env.local` con las variables de Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu_supabase_anon_key
```

3. Iniciar el servidor de desarrollo:

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm start` | Servidor de producción |
| `npm run lint` | Ejecutar ESLint |

## Deploy

La forma más simple es usar [Vercel](https://vercel.com):

1. Conectar el repo a Vercel
2. Configurar las variables de entorno (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
3. Deploy automático en cada push
