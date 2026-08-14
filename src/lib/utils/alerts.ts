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
  categoryOverAvg: 0.45,
  categoryMinHistory: 2,
  paceOverPrev: 0.2,
  paceMinDay: 5,
  largeExpenseMultiple: 5,
  largeExpenseMinHistory: 20,
  fixedCostJump: 0.15,
  fixedMissingGraceDays: 3,
  categoryDominance: 0.4,
  // With two categories one must exceed 40 %, so the claim only means
  // something once there is a real spread to stand out from.
  categoryDominanceMinCategories: 4,
  noIncomeMinDay: 10,
  incomeBelowAvg: 0.3,
  incomeJudgeFromDay: 25,
  sourceConcentration: 0.8,
  snapshotStaleDays: 45,
  platformConcentration: 0.5,
  platformConcentrationMinPlatforms: 3,
  arsHeavyShare: 0.7,
  assetBelowCost: 0.15,
  assetAboveCost: 0.25,
  rateMove24h: 5,
  rateMoveWeek: 5,
  blueExtremeDays: 90,
  noLoggingDays: 10,
  maxAlerts: 12,
} as const;

export interface AlertExpense {
  id: string;
  date: string;
  category: string;
  description: string;
  /** Already converted to ARS. */
  amountArs: number;
}

export interface AlertSnapshot {
  date: string;
  totalArs: number;
}

export interface AlertPosition {
  asset: string;
  avgPriceUsd: number | null;
  currentPriceUsd: number | null;
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
  /** Prior months' expenses in ARS, per category, per month. */
  historyByCategory: Map<string, number[]>;
  /**
   * Categories the user marked as monthly-fixed. Held flat when projecting
   * month-end spend rather than scaled as a daily rate.
   */
  fixedCategories: ReadonlySet<string>;
  /** Every expense of the window, for per-transaction rules. */
  expenses: AlertExpense[];
  /** Income totals per source over the whole window. */
  sourceTotals: Map<string, number>;
  totalIncomes: number;
  totalExpenses: number;

  /** Ascending by date. */
  snapshots: AlertSnapshot[];
  daysSinceSnapshot: number | null;
  /** Latest snapshot holdings in ARS, by currency and by platform. */
  latestByCurrency: Map<string, number>;
  latestByPlatform: Map<string, number>;

  positions: AlertPosition[];

  btcChange24h?: number;
  ethChange24h?: number;
  blueWeekChangePct?: number;
  /** Ascending daily blue quotes, for valuing snapshots and spotting extremes. */
  blueSeries?: { fecha: string; venta: number }[];
  /** Current ARS value of the user's USD holdings, for context on a blue move. */
  usdHoldingsArs?: number;
  /** Blue rate at each of the last two snapshot dates, when resolvable. */
  blueAtLatest?: number;
  blueAtPrevious?: number;
  /** Compounded inflation between the last two snapshots, as a percentage. */
  inflationBetweenSnapshots?: number;
}

/** Names the fixed categories in the alert copy. */
function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function pct(value: number): string {
  return `${Math.round(Math.abs(value))} %`;
}

// ---------------------------------------------------------------- gastos

function categoryAboveAverage(input: BuildAlertsInput): Alert[] {
  const out: Alert[] = [];
  for (const [category, current] of input.currentByCategory) {
    const history = input.historyByCategory.get(category) ?? [];
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
  const fixedNames: string[] = [];
  for (const [category, amount] of input.currentByCategory) {
    if (!input.fixedCategories.has(category)) continue;
    fixed += amount;
    fixedNames.push(category);
  }
  const variable = Math.max(currentTotal - fixed, 0);
  const projected = fixed + (variable / day) * daysInMonth;
  const over = (projected - prevTotal) / prevTotal;
  if (over < T.paceOverPrev) return [];

  const basis =
    fixed > 0
      ? `Proyecté ${formatCurrencyWhole(variable)} de gasto variable en ${day} días; los ${formatCurrencyWhole(fixed)} de ${joinNames(fixedNames)} quedan como están porque no se repiten en el mes.`
      : `Proyectado sobre ${formatCurrencyWhole(currentTotal)} en ${day} días.`;

  return [
    {
      id: "pace",
      level: "warn",
      priority: 10,
      title: `A este ritmo cerrás el mes ${pct(over * 100)} arriba`,
      detail: `${formatCurrencyWhole(projected)} contra ${formatCurrencyWhole(prevTotal)} el mes pasado. ${basis}`,
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

function unusuallyLargeExpense(input: BuildAlertsInput): Alert[] {
  if (input.expenses.length < T.largeExpenseMinHistory) return [];

  const typical = median(input.expenses.map((e) => e.amountArs));
  if (typical <= 0) return [];

  const current = input.expenses.filter((e) => monthKey(e.date) === input.currentMonthKey);
  if (current.length === 0) return [];

  const biggest = current.reduce((a, b) => (b.amountArs > a.amountArs ? b : a));
  if (biggest.amountArs < typical * T.largeExpenseMultiple) return [];

  const times = Math.round(biggest.amountArs / typical);
  const what = biggest.description?.trim() || biggest.category;
  return [
    {
      id: `large-${biggest.id}`,
      level: "info",
      priority: 40,
      title: `Un gasto de ${formatCurrencyWhole(biggest.amountArs)} se sale de lo habitual`,
      detail: `${what} · ${biggest.category}, el ${formatDayMonth(biggest.date)}. Es unas ${times} veces tu gasto típico de ${formatCurrencyWhole(typical)}.`,
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

function fixedCostIncreased(input: BuildAlertsInput): Alert[] {
  const out: Alert[] = [];
  for (const [category, current] of input.currentByCategory) {
    if (!input.fixedCategories.has(category)) continue;

    const history = input.historyByCategory.get(category) ?? [];
    if (history.length === 0) continue;

    const previous = history[history.length - 1];
    if (previous <= 0) continue;

    const jump = (current - previous) / previous;
    if (jump < T.fixedCostJump) continue;

    out.push({
      id: `fixed-up-${category}`,
      level: "warn",
      priority: 15,
      title: `${category} subió ${pct(jump * 100)} respecto al mes pasado`,
      detail: `De ${formatCurrencyWhole(previous)} a ${formatCurrencyWhole(current)}. Es un gasto fijo, así que el aumento se repite todos los meses.`,
    });
  }
  return out;
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
    // Only for charges that really are monthly: present in at least 3 prior months.
    if ((monthsByCategory.get(category)?.size ?? 0) < 3) continue;
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

  return [
    {
      id: `dominant-${topName}`,
      level: "info",
      priority: 60,
      title: `${pct(share * 100)} de tus gastos del mes fue en ${topName}`,
      detail: `${formatCurrencyWhole(topAmount)} de ${formatCurrencyWhole(input.totalExpenses)}.`,
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
      title: `Todavía no registraste ingresos este mes`,
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

function incomeConcentration(input: BuildAlertsInput): Alert[] {
  const total = [...input.sourceTotals.values()].reduce((s, v) => s + v, 0);
  if (total <= 0 || input.sourceTotals.size < 2) return [];

  let topName = "";
  let topAmount = 0;
  for (const [source, amount] of input.sourceTotals) {
    if (amount > topAmount) {
      topAmount = amount;
      topName = source;
    }
  }
  const share = topAmount / total;
  if (share < T.sourceConcentration) return [];

  return [
    {
      id: `source-concentration-${topName}`,
      level: "info",
      priority: 70,
      title: `${pct(share * 100)} de tus ingresos viene de ${topName}`,
      detail: "Mirado sobre los últimos doce meses. Si esa fuente se corta, se corta casi todo.",
    },
  ];
}

// ------------------------------------------------------------ patrimonio

function snapshotHygiene(input: BuildAlertsInput): Alert[] {
  if (input.snapshots.length === 0) {
    return [
      {
        id: "no-snapshot-ever",
        level: "warn",
        priority: 8,
        title: "Todavía no registraste tu patrimonio",
        detail:
          "El patrimonio estimado se calcula a partir del último cierre, así que sin uno el número de arriba no tiene base.",
      },
    ];
  }

  if (input.daysSinceSnapshot !== null && input.daysSinceSnapshot > T.snapshotStaleDays) {
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
  return [];
}

function patrimonyMovement(input: BuildAlertsInput): Alert[] {
  const { snapshots } = input;
  if (snapshots.length < 2) return [];

  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots[snapshots.length - 2];
  if (previous.totalArs <= 0) return [];

  const out: Alert[] = [];
  const changeArs = ((latest.totalArs - previous.totalArs) / previous.totalArs) * 100;

  if (changeArs < 0) {
    out.push({
      id: "patrimony-down",
      level: "warn",
      priority: 22,
      title: `Tu patrimonio bajó ${pct(changeArs)} entre cierres`,
      detail: `De ${formatCurrencyWhole(previous.totalArs)} a ${formatCurrencyWhole(latest.totalArs)}, medido en pesos.`,
    });
  }

  // The peso figure can grow while the real position shrinks. This is the whole
  // reason the app converts anything at all, so it deserves to be said plainly.
  if (input.blueAtLatest && input.blueAtPrevious) {
    const usdLatest = latest.totalArs / input.blueAtLatest;
    const usdPrevious = previous.totalArs / input.blueAtPrevious;
    if (usdPrevious > 0) {
      const changeUsd = ((usdLatest - usdPrevious) / usdPrevious) * 100;
      const blueChange =
        ((input.blueAtLatest - input.blueAtPrevious) / input.blueAtPrevious) * 100;

      if (changeArs > 0 && changeUsd < 0) {
        out.push({
          id: "patrimony-usd-diverges",
          level: "warn",
          priority: 6,
          token: "cur.usd",
          title: `Subiste ${pct(changeArs)} en pesos, pero bajaste ${pct(changeUsd)} en dólares`,
          detail: `El blue se movió ${formatPercentage(blueChange)} entre los dos cierres. En dólares pasaste de US$ ${Math.round(usdPrevious).toLocaleString("es-AR")} a US$ ${Math.round(usdLatest).toLocaleString("es-AR")}.`,
        });
      } else if (changeArs < 0 && changeUsd > 0) {
        out.push({
          id: "patrimony-usd-diverges",
          level: "info",
          priority: 62,
          token: "cur.usd",
          title: `Bajaste ${pct(changeArs)} en pesos, pero subiste ${pct(changeUsd)} en dólares`,
          detail: `El blue se movió ${formatPercentage(blueChange)} entre los dos cierres.`,
        });
      }
    }
  }

  // Same idea against prices rather than the dollar.
  if (input.inflationBetweenSnapshots !== undefined && changeArs >= 0) {
    const inflation = input.inflationBetweenSnapshots;
    if (inflation > 0 && changeArs < inflation) {
      const realChange = ((1 + changeArs / 100) / (1 + inflation / 100) - 1) * 100;
      out.push({
        id: "patrimony-vs-inflation",
        level: "warn",
        priority: 7,
        title: `Tu patrimonio creció menos que la inflación`,
        detail: `Subió ${formatPercentage(changeArs)} entre cierres, pero los precios subieron ${formatPercentage(inflation)}. En poder de compra es ${formatPercentage(realChange)}.`,
      });
    }
  }

  return out;
}

function holdingsShape(input: BuildAlertsInput): Alert[] {
  const out: Alert[] = [];

  const platformTotal = [...input.latestByPlatform.values()].reduce((s, v) => s + v, 0);
  if (platformTotal > 0 && input.latestByPlatform.size >= T.platformConcentrationMinPlatforms) {
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

// ----------------------------------------------------------- inversiones

function investmentPositions(input: BuildAlertsInput): Alert[] {
  const out: Alert[] = [];
  for (const position of input.positions) {
    const { asset, avgPriceUsd, currentPriceUsd } = position;
    if (!avgPriceUsd || !currentPriceUsd || avgPriceUsd <= 0) continue;

    const change = (currentPriceUsd - avgPriceUsd) / avgPriceUsd;

    if (change <= -T.assetBelowCost) {
      out.push({
        id: `asset-down-${asset}`,
        level: "warn",
        priority: 30,
        title: `${asset} está ${pct(change * 100)} abajo de tu precio promedio de compra`,
        detail: `Compraste a un promedio de US$ ${avgPriceUsd.toLocaleString("es-AR", { maximumFractionDigits: 2 })} y hoy vale US$ ${currentPriceUsd.toLocaleString("es-AR", { maximumFractionDigits: 2 })}.`,
      });
    } else if (change >= T.assetAboveCost) {
      out.push({
        id: `asset-up-${asset}`,
        level: "info",
        priority: 64,
        title: `${asset} está ${pct(change * 100)} arriba de tu precio promedio de compra`,
        detail: `Compraste a un promedio de US$ ${avgPriceUsd.toLocaleString("es-AR", { maximumFractionDigits: 2 })} y hoy vale US$ ${currentPriceUsd.toLocaleString("es-AR", { maximumFractionDigits: 2 })}.`,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------- cotizaciones

function rateMoves(input: BuildAlertsInput): Alert[] {
  const out: Alert[] = [];

  if (
    input.blueWeekChangePct !== undefined &&
    Math.abs(input.blueWeekChangePct) >= T.rateMoveWeek
  ) {
    const up = input.blueWeekChangePct > 0;
    const holdings =
      input.usdHoldingsArs && input.usdHoldingsArs > 0
        ? ` Tus dólares ${up ? "valen" : "bajaron"} ${formatCurrencyWhole(Math.abs((input.usdHoldingsArs * input.blueWeekChangePct) / 100))} ${up ? "más" : "menos"} en pesos.`
        : "";
    out.push({
      id: "blue-move",
      level: "info",
      priority: 50,
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
    if (change === undefined || Math.abs(change) < T.rateMove24h) continue;
    out.push({
      id: `crypto-${name}`,
      level: "info",
      priority: 52,
      token,
      title: `${name} ${change > 0 ? "subió" : "bajó"} ${formatPercentage(change)} en 24 h`,
      detail: "Tu patrimonio estimado ya toma este precio.",
    });
  }

  // A rate at the edge of its recent range is worth a glance whichever way it went.
  const series = input.blueSeries ?? [];
  if (series.length >= 30) {
    const window = series.slice(-T.blueExtremeDays);
    const values = window.map((p) => p.venta);
    const current = values[values.length - 1];
    const high = Math.max(...values);
    const low = Math.min(...values);

    if (current === high && high > low) {
      out.push({
        id: "blue-high",
        level: "info",
        priority: 54,
        token: "cur.usd",
        title: `El blue está en su valor más alto de los últimos ${window.length} días`,
        detail: `${formatCurrencyWhole(current)}, contra un mínimo de ${formatCurrencyWhole(low)} en el mismo período.`,
      });
    } else if (current === low && high > low) {
      out.push({
        id: "blue-low",
        level: "info",
        priority: 54,
        token: "cur.usd",
        title: `El blue está en su valor más bajo de los últimos ${window.length} días`,
        detail: `${formatCurrencyWhole(current)}, contra un máximo de ${formatCurrencyWhole(high)} en el mismo período.`,
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
  spendingPace,
  negativeBalance,
  patrimonyMovement,
  snapshotHygiene,
  loggingGap,
  missingFixedCharge,
  noIncomeYet,
  fixedCostIncreased,
  categoryAboveAverage,
  incomeBelowAverage,
  possibleDuplicate,
  investmentPositions,
  unusuallyLargeExpense,
  rateMoves,
  dominantCategory,
  incomeConcentration,
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

/** Percent change between the first and last point of a rate series. */
export function seriesChangePct(series: { venta: number }[]): number | undefined {
  if (series.length < 2) return undefined;
  const first = series[0].venta;
  const last = series[series.length - 1].venta;
  if (!first) return undefined;
  return ((last - first) / first) * 100;
}
