import { formatCurrencyWhole, formatPercentage, formatDayMonth } from "./format";

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
  /** Lower sorts first within a level. */
  priority: number;
}

/**
 * Thresholds are deliberately loose. An alert that fires every month stops
 * being an alert, so each one is tuned to stay quiet in an ordinary month.
 */
const T = {
  /** Well clear of its own norm, not merely above it. */
  categoryOverAvg: 0.75,
  categoryMinHistory: 2,
  paceOverPrev: 0.2,
  paceMinDay: 5,
  fixedMissingGraceDays: 3,
  fixedMissingMinMonths: 3,
  categoryDominance: 0.4,
  // With two categories one must exceed 40 %, so the claim only means
  // something once there is a real spread to stand out from.
  categoryDominanceMinCategories: 4,
  /** …and only when the category is taking more than its usual slice. */
  categoryDominanceOverUsual: 1.3,
  categoryDominanceMinHistory: 2,
  noIncomeMinDay: 10,
  incomeBelowAvg: 0.3,
  incomeJudgeFromDay: 25,
  snapshotStaleDays: 45,
  platformConcentration: 0.7,
  platformConcentrationMinPlatforms: 3,
  arsHeavyShare: 0.8,
  noLoggingDays: 10,
  maxAlerts: 12,
} as const;

export interface AlertExpense {
  id: string;
  date: string;
  category: string;
  /** Already converted to ARS. */
  amountArs: number;
}

export interface AlertSnapshot {
  date: string;
  totalArs: number;
}

export interface BuildAlertsInput {
  /** Reference "now" — passed in so the rules stay pure and testable. */
  today: Date;
  currentMonthKey: string;
  prevMonthKey: string;

  /** Expenses and incomes already converted to ARS, keyed by month (`YYYY-MM`). */
  expensesByMonth: Map<string, number>;
  incomesByMonth: Map<string, number>;
  /** Current-month expenses in ARS, per category. */
  currentByCategory: Map<string, number>;
  /**
   * Prior months' expenses in ARS: month key → category → amount. Keeping the
   * month structure (rather than a flat list per category) is what lets a rule
   * ask about a category's *share* of its month, not only its size.
   */
  historyByMonth: Map<string, Map<string, number>>;
  /**
   * Categories the user marked as monthly-fixed. Held flat when projecting
   * month-end spend rather than scaled as a daily rate.
   */
  fixedCategories: ReadonlySet<string>;
  /** Every expense of the window, for per-transaction rules. */
  expenses: AlertExpense[];
  totalIncomes: number;
  totalExpenses: number;

  /** Ascending by date. */
  snapshots: AlertSnapshot[];
  daysSinceSnapshot: number | null;
  /** Latest snapshot holdings in ARS, by currency and by platform. */
  latestByCurrency: Map<string, number>;
  latestByPlatform: Map<string, number>;

  /** Compounded inflation between the last two snapshots, as a percentage. */
  inflationBetweenSnapshots?: number;
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function pct(value: number): string {
  return `${Math.round(Math.abs(value))} %`;
}

/** A category's totals across the prior months, oldest first. */
function historyFor(input: BuildAlertsInput, category: string): number[] {
  const out: number[] = [];
  for (const key of [...input.historyByMonth.keys()].sort()) {
    const amount = input.historyByMonth.get(key)?.get(category);
    if (amount !== undefined) out.push(amount);
  }
  return out;
}

// ---------------------------------------------------------------- gastos

function categoryAboveAverage(input: BuildAlertsInput): Alert[] {
  const out: Alert[] = [];
  for (const [category, current] of input.currentByCategory) {
    const history = historyFor(input, category);
    if (history.length < T.categoryMinHistory) continue;

    const avg = history.reduce((s, v) => s + v, 0) / history.length;
    if (avg <= 0) continue;

    const over = (current - avg) / avg;
    if (over < T.categoryOverAvg) continue;

    out.push({
      id: `cat-over-${category}`,
      level: "warn",
      priority: 20,
      title: `${category} va ${pct(over * 100)} arriba de tu promedio`,
      detail: `Llevás ${formatCurrencyWhole(current)} este mes. Tu promedio de los últimos ${history.length} meses es ${formatCurrencyWhole(avg)}.`,
    });
  }
  return out;
}

function spendingPace(input: BuildAlertsInput): Alert[] {
  const prevTotal = input.expensesByMonth.get(input.prevMonthKey) ?? 0;
  const currentTotal = input.expensesByMonth.get(input.currentMonthKey) ?? 0;
  const day = input.today.getDate();
  const daysInMonth = new Date(
    input.today.getFullYear(),
    input.today.getMonth() + 1,
    0
  ).getDate();

  if (prevTotal <= 0 || currentTotal <= 0) return [];
  if (day < T.paceMinDay || day >= daysInMonth) return [];

  // Rent, utilities and subscriptions hit once and are done. Scaling the whole
  // month-to-date total would treat them as a daily rate and badly overstate
  // the projection, so only the variable part gets extrapolated.
  let fixed = 0;
  for (const [category, amount] of input.currentByCategory) {
    if (input.fixedCategories.has(category)) fixed += amount;
  }
  const variable = Math.max(currentTotal - fixed, 0);
  const projected = fixed + (variable / day) * daysInMonth;
  const over = (projected - prevTotal) / prevTotal;
  if (over < T.paceOverPrev) return [];

  return [
    {
      id: "pace",
      level: "warn",
      priority: 10,
      title: `A este ritmo cerrás el mes ${pct(over * 100)} arriba`,
      detail: `${formatCurrencyWhole(projected)} contra ${formatCurrencyWhole(prevTotal)} el mes pasado.`,
    },
  ];
}

function negativeBalance(input: BuildAlertsInput): Alert[] {
  if (input.totalIncomes <= 0 || input.totalExpenses <= input.totalIncomes) return [];
  const gap = input.totalExpenses - input.totalIncomes;
  return [
    {
      id: "negative-balance",
      level: "warn",
      priority: 5,
      title: "Gastaste más de lo que entró este mes",
      detail: `${formatCurrencyWhole(gap)} por encima de tus ingresos. Se cubre con lo que ya tenías.`,
    },
  ];
}

function possibleDuplicate(input: BuildAlertsInput): Alert[] {
  const current = input.expenses.filter((e) => monthKey(e.date) === input.currentMonthKey);
  const seen = new Map<string, AlertExpense[]>();

  for (const e of current) {
    // Same day, same category, same amount to the peso: almost always a
    // double-tap on the form rather than two real purchases.
    const key = `${e.date}|${e.category}|${Math.round(e.amountArs)}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(e);
  }

  for (const [, group] of seen) {
    if (group.length < 2) continue;
    const e = group[0];
    return [
      {
        id: `dup-${e.id}`,
        level: "warn",
        priority: 25,
        title: "Puede que hayas cargado un gasto dos veces",
        detail: `${group.length} gastos de ${formatCurrencyWhole(e.amountArs)} en ${e.category}, todos el ${formatDayMonth(e.date)}.`,
      },
    ];
  }
  return [];
}

function missingFixedCharge(input: BuildAlertsInput): Alert[] {
  const day = input.today.getDate();
  const out: Alert[] = [];

  // Which day of the month each fixed category usually lands on.
  const daysByCategory = new Map<string, number[]>();
  const monthsByCategory = new Map<string, Set<string>>();
  for (const e of input.expenses) {
    if (!input.fixedCategories.has(e.category)) continue;
    const key = monthKey(e.date);
    if (key === input.currentMonthKey) continue;
    if (!daysByCategory.has(e.category)) daysByCategory.set(e.category, []);
    if (!monthsByCategory.has(e.category)) monthsByCategory.set(e.category, new Set());
    daysByCategory.get(e.category)!.push(Number(e.date.slice(8, 10)));
    monthsByCategory.get(e.category)!.add(key);
  }

  for (const [category, days] of daysByCategory) {
    // Only for charges that really are monthly.
    if ((monthsByCategory.get(category)?.size ?? 0) < T.fixedMissingMinMonths) continue;
    if (input.currentByCategory.has(category)) continue;

    const usualDay = Math.round(days.reduce((s, d) => s + d, 0) / days.length);
    if (day < usualDay + T.fixedMissingGraceDays) continue;

    out.push({
      id: `fixed-missing-${category}`,
      level: "warn",
      priority: 12,
      title: `Todavía no registraste ${category} este mes`,
      detail: `Lo venís pagando todos los meses, normalmente cerca del día ${usualDay}. Puede que falte cargarlo o que falte pagarlo.`,
    });
  }
  return out;
}

function dominantCategory(input: BuildAlertsInput): Alert[] {
  if (input.totalExpenses <= 0) return [];
  if (input.currentByCategory.size < T.categoryDominanceMinCategories) return [];

  let topName = "";
  let topAmount = 0;
  for (const [category, amount] of input.currentByCategory) {
    if (amount > topAmount) {
      topAmount = amount;
      topName = category;
    }
  }
  const share = topAmount / input.totalExpenses;
  if (share < T.categoryDominance) return [];

  // A category that always leads is not news. Only say something when it is
  // taking a bigger slice than it usually does.
  const priorShares: number[] = [];
  for (const [, categories] of input.historyByMonth) {
    const monthTotal = [...categories.values()].reduce((s, v) => s + v, 0);
    if (monthTotal <= 0) continue;
    priorShares.push((categories.get(topName) ?? 0) / monthTotal);
  }
  if (priorShares.length < T.categoryDominanceMinHistory) return [];

  const usualShare = priorShares.reduce((s, v) => s + v, 0) / priorShares.length;
  if (usualShare <= 0) return [];
  if (share < usualShare * T.categoryDominanceOverUsual) return [];

  return [
    {
      id: `dominant-${topName}`,
      level: "info",
      priority: 60,
      title: `${pct(share * 100)} de tus gastos del mes fue en ${topName}`,
      detail: `${formatCurrencyWhole(topAmount)} de ${formatCurrencyWhole(input.totalExpenses)}. Normalmente esta categoría es el ${pct(usualShare * 100)} de tus gastos.`,
    },
  ];
}

// -------------------------------------------------------------- ingresos

function noIncomeYet(input: BuildAlertsInput): Alert[] {
  const day = input.today.getDate();
  if (day < T.noIncomeMinDay) return [];
  if ((input.incomesByMonth.get(input.currentMonthKey) ?? 0) > 0) return [];

  // Only if income is actually a monthly habit.
  const prior = [...input.incomesByMonth.entries()]
    .filter(([key]) => key !== input.currentMonthKey)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 3);
  const monthsWithIncome = prior.filter(([, total]) => total > 0).length;
  if (prior.length < 3 || monthsWithIncome < 2) return [];

  return [
    {
      id: "no-income-yet",
      level: "warn",
      priority: 14,
      title: "Todavía no registraste ingresos este mes",
      detail: `Van ${day} días y en los meses anteriores para esta altura ya habías cargado alguno.`,
    },
  ];
}

function incomeBelowAverage(input: BuildAlertsInput): Alert[] {
  const day = input.today.getDate();
  // Comparing a partial month against full ones is only fair near the end.
  if (day < T.incomeJudgeFromDay) return [];

  const current = input.incomesByMonth.get(input.currentMonthKey) ?? 0;
  if (current <= 0) return [];

  const prior = [...input.incomesByMonth.entries()]
    .filter(([key]) => key !== input.currentMonthKey)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 3)
    .map(([, total]) => total)
    .filter((total) => total > 0);
  if (prior.length < 2) return [];

  const avg = prior.reduce((s, v) => s + v, 0) / prior.length;
  const below = (avg - current) / avg;
  if (below < T.incomeBelowAvg) return [];

  return [
    {
      id: "income-below-avg",
      level: "warn",
      priority: 18,
      title: `Tus ingresos del mes van ${pct(below * 100)} abajo de tu promedio`,
      detail: `${formatCurrencyWhole(current)} contra un promedio de ${formatCurrencyWhole(avg)} en los últimos ${prior.length} meses.`,
    },
  ];
}

// ------------------------------------------------------------ patrimonio

function staleSnapshot(input: BuildAlertsInput): Alert[] {
  if (input.snapshots.length === 0) return [];
  if (input.daysSinceSnapshot === null || input.daysSinceSnapshot <= T.snapshotStaleDays) {
    return [];
  }
  return [
    {
      id: "stale-snapshot",
      level: "warn",
      priority: 16,
      title: `Hace ${input.daysSinceSnapshot} días que no registrás tu patrimonio`,
      detail:
        "El patrimonio estimado parte del último cierre, así que se vuelve menos preciso con el tiempo.",
    },
  ];
}

function patrimonyVsInflation(input: BuildAlertsInput): Alert[] {
  const { snapshots, inflationBetweenSnapshots: inflation } = input;
  if (snapshots.length < 2 || inflation === undefined || inflation <= 0) return [];

  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots[snapshots.length - 2];
  if (previous.totalArs <= 0) return [];

  const changeArs = ((latest.totalArs - previous.totalArs) / previous.totalArs) * 100;
  if (changeArs < 0 || changeArs >= inflation) return [];

  const realChange = ((1 + changeArs / 100) / (1 + inflation / 100) - 1) * 100;
  return [
    {
      id: "patrimony-vs-inflation",
      level: "warn",
      priority: 7,
      title: "Tu patrimonio creció menos que la inflación",
      detail: `Subió ${formatPercentage(changeArs)} entre cierres, pero los precios subieron ${formatPercentage(inflation)}. En poder de compra es ${formatPercentage(realChange)}.`,
    },
  ];
}

function holdingsShape(input: BuildAlertsInput): Alert[] {
  const out: Alert[] = [];

  const platformTotal = [...input.latestByPlatform.values()].reduce((s, v) => s + v, 0);
  if (
    platformTotal > 0 &&
    input.latestByPlatform.size >= T.platformConcentrationMinPlatforms
  ) {
    let topName = "";
    let topAmount = 0;
    for (const [platform, amount] of input.latestByPlatform) {
      if (amount > topAmount) {
        topAmount = amount;
        topName = platform;
      }
    }
    const share = topAmount / platformTotal;
    if (share >= T.platformConcentration) {
      out.push({
        id: `platform-concentration-${topName}`,
        level: "info",
        priority: 72,
        title: `${pct(share * 100)} de tu patrimonio está en ${topName}`,
        detail: `${formatCurrencyWhole(topAmount)} de ${formatCurrencyWhole(platformTotal)} en una sola plataforma.`,
      });
    }
  }

  const currencyTotal = [...input.latestByCurrency.values()].reduce((s, v) => s + v, 0);
  const arsAmount = input.latestByCurrency.get("ARS") ?? 0;
  if (currencyTotal > 0 && input.latestByCurrency.size >= 2) {
    const share = arsAmount / currencyTotal;
    if (share >= T.arsHeavyShare) {
      out.push({
        id: "ars-heavy",
        level: "info",
        priority: 66,
        token: "cur.ars",
        title: `${pct(share * 100)} de tu patrimonio está en pesos`,
        detail: `${formatCurrencyWhole(arsAmount)} sin cobertura frente a la inflación ni al tipo de cambio.`,
      });
    }
  }

  return out;
}

// -------------------------------------------------------------- registro

function loggingGap(input: BuildAlertsInput): Alert[] {
  if (input.expenses.length === 0) return [];

  const latest = input.expenses.reduce((a, b) => (b.date > a.date ? b : a));
  const days = Math.floor(
    (input.today.getTime() - new Date(`${latest.date}T00:00:00`).getTime()) / 86_400_000
  );
  if (days < T.noLoggingDays) return [];

  return [
    {
      id: "logging-gap",
      level: "warn",
      priority: 9,
      title: `Hace ${days} días que no cargás gastos`,
      detail:
        "Todo lo de acá se calcula sobre lo que registrás, así que un hueco largo desdibuja el resto de los números.",
    },
  ];
}

const RULES = [
  negativeBalance,
  patrimonyVsInflation,
  loggingGap,
  spendingPace,
  missingFixedCharge,
  noIncomeYet,
  staleSnapshot,
  incomeBelowAverage,
  categoryAboveAverage,
  possibleDuplicate,
  dominantCategory,
  holdingsShape,
];

export function buildAlerts(input: BuildAlertsInput): Alert[] {
  const alerts = RULES.flatMap((rule) => rule(input));

  // Things needing a decision first, then context; within each, most useful first.
  alerts.sort((a, b) => {
    if (a.level !== b.level) return a.level === "warn" ? -1 : 1;
    return a.priority - b.priority;
  });

  return alerts.slice(0, T.maxAlerts);
}
