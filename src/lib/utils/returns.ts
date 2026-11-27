/**
 * What your money earned on its own: how much the net worth grew beyond what
 * you put into it. Pure and import-free, so it can be tested with tsx.
 *
 * Between two closes the net worth moves for two reasons:
 *
 *   end − start = savings + gain
 *
 * Savings are the money that came from outside (salary and other income minus
 * expenses). Everything else is the gain: dollars and pesos repricing, interest,
 * investments, trading. So `gain = end − start − savings`.
 *
 * The percentage of each period is Modified Dietz: the gain over the capital
 * that was actually at work, the opening balance plus each movement weighted by
 * the share of the period it was held. A salary that lands the day before the
 * close barely counts as capital, one that lands the day after the opening
 * counts almost in full.
 *
 *   r = gain / (start + Σ flow × days left after it ÷ days in the period)
 *
 * Periods chain into one time-weighted return, Π(1 + r) − 1, so a big salary
 * neither inflates nor dilutes the percentage: it measures how the money did,
 * not how much money there was.
 *
 * Everything is in dollars, each value at the blue of its own date. In pesos,
 * inflation would turn any balance into a "gain".
 */

export interface ReturnClose {
  date: string;
  valueUsd: number;
  /** Today's estimate rather than a recorded close. */
  estimate?: boolean;
}

/** One movement from outside the net worth, in dollars: + income, − expense. */
export interface ReturnFlow {
  date: string;
  amountUsd: number;
}

export interface ReturnPeriod {
  from: string;
  to: string;
  startUsd: number;
  endUsd: number;
  savedUsd: number;
  gainUsd: number;
  /** As a fraction (0.02 is 2 %). Null when no capital was at work. */
  rate: number | null;
  estimate: boolean;
}

export interface ReturnMonth {
  /** `YYYY-MM` of the close that ends it. */
  month: string;
  gainUsd: number;
  savedUsd: number;
  rate: number | null;
  /** Running totals from the start of the measure. */
  cumulativeGainUsd: number;
  cumulativeRate: number;
  estimate: boolean;
}

export interface ReturnSummary {
  startDate: string;
  endDate: string;
  startUsd: number;
  endUsd: number;
  savedUsd: number;
  gainUsd: number;
  /** Time-weighted, as a fraction. */
  rate: number;
  /** Ends on today's estimate rather than on a close. */
  estimate: boolean;
  periods: ReturnPeriod[];
  months: ReturnMonth[];
}

const DAY = 86_400_000;
const time = (date: string) => Date.parse(`${date}T00:00:00Z`);

function dayBefore(date: string): string {
  return new Date(time(date) - DAY).toISOString().slice(0, 10);
}

/**
 * The first close the measure can start from. Before the first recorded
 * movement nothing tells savings and gain apart, so the opening close must
 * fall no earlier than the day before the month of that movement: a close on
 * 31 Jan opens February, one on 20 Jan would leave eleven unrecorded days in.
 */
export function firstMeasurableClose(closes: readonly ReturnClose[], firstFlowDate: string): number {
  const earliest = dayBefore(`${firstFlowDate.slice(0, 7)}-01`);
  return closes.findIndex((c) => c.date >= earliest);
}

export function periodReturn(from: ReturnClose, to: ReturnClose, flows: readonly ReturnFlow[]): ReturnPeriod {
  const span = Math.max(time(to.date) - time(from.date), DAY);
  let savedUsd = 0;
  let weighted = 0;
  for (const f of flows) {
    if (f.date <= from.date || f.date > to.date) continue;
    savedUsd += f.amountUsd;
    const left = Math.min(Math.max((time(to.date) - time(f.date)) / span, 0), 1);
    weighted += f.amountUsd * left;
  }
  const gainUsd = to.valueUsd - from.valueUsd - savedUsd;
  const capital = from.valueUsd + weighted;
  return {
    from: from.date,
    to: to.date,
    startUsd: from.valueUsd,
    endUsd: to.valueUsd,
    savedUsd,
    gainUsd,
    rate: capital > 0 ? gainUsd / capital : null,
    estimate: !!to.estimate,
  };
}

/**
 * The return from the first measurable close to the last one (or today's
 * estimate, when it is passed last with `estimate: true`). Null when there are
 * fewer than two closes to measure between.
 *
 * `closes` ascending by date. Flows dated after the last close are ignored.
 */
export function buildReturns(closes: readonly ReturnClose[], flows: readonly ReturnFlow[]): ReturnSummary | null {
  if (flows.length === 0) return null;
  const firstFlow = flows.reduce((min, f) => (f.date < min ? f.date : min), flows[0].date);
  const sorted = [...closes].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const start = firstMeasurableClose(sorted, firstFlow);
  if (start === -1 || start >= sorted.length - 1) return null;

  const periods: ReturnPeriod[] = [];
  for (let i = start + 1; i < sorted.length; i++) periods.push(periodReturn(sorted[i - 1], sorted[i], flows));

  const months: ReturnMonth[] = [];
  let cumGain = 0;
  let growth = 1;
  for (const p of periods) {
    cumGain += p.gainUsd;
    if (p.rate !== null) growth *= 1 + p.rate;
    const month = p.to.slice(0, 7);
    const last = months[months.length - 1];
    if (last && last.month === month) {
      // Two closes in one month: one row, its rates compounded.
      last.gainUsd += p.gainUsd;
      last.savedUsd += p.savedUsd;
      last.rate = last.rate === null ? p.rate : p.rate === null ? last.rate : (1 + last.rate) * (1 + p.rate) - 1;
      last.cumulativeGainUsd = cumGain;
      last.cumulativeRate = growth - 1;
      last.estimate = p.estimate;
    } else {
      months.push({
        month,
        gainUsd: p.gainUsd,
        savedUsd: p.savedUsd,
        rate: p.rate,
        cumulativeGainUsd: cumGain,
        cumulativeRate: growth - 1,
        estimate: p.estimate,
      });
    }
  }

  const first = sorted[start];
  const last = sorted[sorted.length - 1];
  return {
    startDate: first.date,
    endDate: last.date,
    startUsd: first.valueUsd,
    endUsd: last.valueUsd,
    savedUsd: periods.reduce((s, p) => s + p.savedUsd, 0),
    gainUsd: cumGain,
    rate: growth - 1,
    estimate: !!last.estimate,
    periods,
    months,
  };
}
