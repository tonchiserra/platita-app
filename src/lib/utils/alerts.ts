import { formatCurrency, formatPercentage } from "./format";

/** Names the fixed categories in the alert copy. */
function fixedCategoryLabel(names: string[]): string {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/**
 * `warn` needs a decision from the user; `info` is worth knowing but fine.
 * Nothing here is an error — this surfaces things the numbers already say but
 * that you would only notice by comparing several screens by hand.
 */
export type AlertLevel = "warn" | "info";

export interface Alert {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
  /** Currency colour token, when the alert is about one currency. */
  token?: string;
}

/** Thresholds are deliberately loose — an alert that fires every month is noise. */
const CATEGORY_OVER_AVG = 0.45;
const CATEGORY_MIN_HISTORY = 2;
const PACE_OVER_PREV = 0.2;
const RATE_MOVE_24H = 5;
const RATE_MOVE_WEEK = 5;
const SNAPSHOT_STALE_DAYS = 45;

interface MonthlyRow {
  amount: number;
  currency: string;
  category?: string;
  date: string;
}

interface BuildAlertsInput {
  /** Expenses already converted to ARS, keyed by month (`YYYY-MM`). */
  expensesByMonth: Map<string, number>;
  /** Current-month expenses in ARS, per category. */
  currentByCategory: Map<string, number>;
  /**
   * Categories the user marked as monthly-fixed. Held flat when projecting
   * month-end spend rather than scaled as a daily rate.
   */
  fixedCategories: ReadonlySet<string>;
  /** Prior months' expenses in ARS, per category, per month. */
  historyByCategory: Map<string, number[]>;
  currentMonthKey: string;
  prevMonthKey: string;
  dayOfMonth: number;
  daysInMonth: number;
  totalIncomes: number;
  totalExpenses: number;
  /** Days since the most recent patrimony snapshot, if any. */
  daysSinceSnapshot: number | null;
  btcChange24h?: number;
  ethChange24h?: number;
  blueWeekChangePct?: number;
  /** Current ARS value of the user's USD holdings, for context on a blue move. */
  usdHoldingsArs?: number;
}

export function buildAlerts(input: BuildAlertsInput): Alert[] {
  const alerts: Alert[] = [];

  // --- A category running well above its own recent norm ---
  for (const [category, current] of input.currentByCategory) {
    const history = input.historyByCategory.get(category) ?? [];
    if (history.length < CATEGORY_MIN_HISTORY) continue;

    const avg = history.reduce((s, v) => s + v, 0) / history.length;
    if (avg <= 0) continue;

    const over = (current - avg) / avg;
    if (over < CATEGORY_OVER_AVG) continue;

    alerts.push({
      id: `cat-${category}`,
      level: "warn",
      title: `${category} va ${Math.round(over * 100)} % arriba de tu promedio`,
      detail: `Llevás ${formatCurrency(current)} este mes. Tu promedio de los últimos ${history.length} meses es ${formatCurrency(avg)}.`,
    });
  }

  // --- Spending pace, projected to the end of the month ---
  // Rent, utilities and subscriptions hit once and are done. Scaling the whole
  // month-to-date total would treat them as a daily rate and badly overstate
  // the projection, so only the variable part gets extrapolated.
  const prevTotal = input.expensesByMonth.get(input.prevMonthKey) ?? 0;
  const currentTotal = input.expensesByMonth.get(input.currentMonthKey) ?? 0;
  if (prevTotal > 0 && currentTotal > 0 && input.dayOfMonth >= 5 && input.dayOfMonth < input.daysInMonth) {
    let fixed = 0;
    const fixedNames: string[] = [];
    for (const [category, amount] of input.currentByCategory) {
      if (!input.fixedCategories.has(category)) continue;
      fixed += amount;
      fixedNames.push(category);
    }
    const variable = Math.max(currentTotal - fixed, 0);
    const projected = fixed + (variable / input.dayOfMonth) * input.daysInMonth;
    const over = (projected - prevTotal) / prevTotal;

    if (over >= PACE_OVER_PREV) {
      const basis =
        fixed > 0
          ? `Proyecté ${formatCurrency(variable)} de gasto variable en ${input.dayOfMonth} días; los ${formatCurrency(fixed)} de ${fixedCategoryLabel(fixedNames)} quedan como están porque no se repiten en el mes.`
          : `Proyectado sobre ${formatCurrency(currentTotal)} en ${input.dayOfMonth} días.`;
      alerts.push({
        id: "pace",
        level: "warn",
        title: `A este ritmo cerrás el mes ${Math.round(over * 100)} % arriba`,
        detail: `${formatCurrency(projected)} contra ${formatCurrency(prevTotal)} el mes pasado. ${basis}`,
      });
    }
  }

  // --- Spent more than came in ---
  if (input.totalIncomes > 0 && input.totalExpenses > input.totalIncomes) {
    const gap = input.totalExpenses - input.totalIncomes;
    alerts.push({
      id: "negative-balance",
      level: "warn",
      title: "Gastaste más de lo que entró este mes",
      detail: `${formatCurrency(gap)} por encima de tus ingresos. Se cubre con lo que ya tenías.`,
    });
  }

  // --- Sharp exchange-rate moves ---
  if (input.blueWeekChangePct !== undefined && Math.abs(input.blueWeekChangePct) >= RATE_MOVE_WEEK) {
    const up = input.blueWeekChangePct > 0;
    const holdings =
      input.usdHoldingsArs && input.usdHoldingsArs > 0
        ? ` Tus dólares ${up ? "valen" : "bajaron"} ${formatCurrency(Math.abs((input.usdHoldingsArs * input.blueWeekChangePct) / 100))} ${up ? "más" : "menos"} en pesos.`
        : "";
    alerts.push({
      id: "blue-move",
      level: "info",
      token: "cur.usd",
      title: `El blue ${up ? "subió" : "bajó"} ${formatPercentage(input.blueWeekChangePct)} en la semana`,
      detail: `Cambia cuánto valen en pesos tus tenencias en dólares.${holdings}`,
    });
  }

  const crypto: [string, number | undefined, string][] = [
    ["Bitcoin", input.btcChange24h, "cur.btc"],
    ["Ethereum", input.ethChange24h, "cur.eth"],
  ];
  for (const [name, change, token] of crypto) {
    if (change === undefined || Math.abs(change) < RATE_MOVE_24H) continue;
    alerts.push({
      id: `crypto-${name}`,
      level: "info",
      token,
      title: `${name} ${change > 0 ? "subió" : "bajó"} ${formatPercentage(change)} en 24 h`,
      detail: "Tu patrimonio estimado ya toma este precio.",
    });
  }

  // --- A stale snapshot quietly degrades the whole estimate ---
  if (input.daysSinceSnapshot !== null && input.daysSinceSnapshot > SNAPSHOT_STALE_DAYS) {
    alerts.push({
      id: "stale-snapshot",
      level: "warn",
      title: `Hace ${input.daysSinceSnapshot} días que no registrás tu patrimonio`,
      detail:
        "El patrimonio estimado parte del último cierre, así que se vuelve menos preciso con el tiempo.",
    });
  }

  // Things needing a decision first, then context.
  return alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === "warn" ? -1 : 1));
}

/** Percent change between the first and last point of a rate series. */
export function seriesChangePct(series: { venta: number }[]): number | undefined {
  if (series.length < 2) return undefined;
  const first = series[0].venta;
  const last = series[series.length - 1].venta;
  if (!first) return undefined;
  return ((last - first) / first) * 100;
}

export type { MonthlyRow };
