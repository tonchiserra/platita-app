/**
 * The movements the last close does not reflect yet: everything dated after
 * it, through the end of the current month. The estimate of today's net worth
 * is that close revalued at today's rates plus these.
 *
 * It used to add the current month's movements alone, which is the same thing
 * only when the last close is last month's. With August and September left
 * unclosed it dropped both, and the estimate fell while the savings rose. Rows
 * dated in a later month — installments, planned charges — stay out: they have
 * not happened yet.
 */
export function flowsSinceClose<T extends { date: string }>(
  rows: readonly T[],
  closeDate: string,
  currentMonth: string
): T[] {
  return rows.filter((row) => row.date > closeDate && row.date.slice(0, 7) <= currentMonth);
}

/**
 * Whether the close fell on the last day of the month before `currentMonth`,
 * making the window exactly the current month — the usual case, where the
 * equation can name the month instead of a date.
 */
export function closeEndsPreviousMonth(closeDate: string, currentMonth: string): boolean {
  const next = new Date(`${closeDate}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10) === `${currentMonth}-01`;
}
