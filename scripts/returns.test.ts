import { buildReturns, firstMeasurableClose, periodReturn } from "@/lib/utils/returns";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, x = "") => {
  if (c) { pass++; console.log("  ok   " + n); }
  else { fail++; console.log("  FAIL " + n + (x ? "  << " + x : "")); }
};
const section = (n: string) => console.log("\n" + n);
const near = (a: number | null, b: number, eps = 1e-9) => a !== null && Math.abs(a - b) < eps;

section("ahorro no es rendimiento");
{
  // 10.000 → 11.000 with 1.000 saved: the money earned nothing.
  const p = periodReturn({ date: "2026-01-31", valueUsd: 10_000 }, { date: "2026-02-28", valueUsd: 11_000 }, [
    { date: "2026-02-05", amountUsd: 2_000 },
    { date: "2026-02-20", amountUsd: -1_000 },
  ]);
  check("savings are income minus expenses", p.savedUsd === 1_000, String(p.savedUsd));
  check("growth that is all savings is zero gain", p.gainUsd === 0, String(p.gainUsd));
  check("zero gain is a zero rate", near(p.rate, 0), String(p.rate));
}

section("el rendimiento sobre el capital que trabajó");
{
  // No movements: plain growth.
  const p = periodReturn({ date: "2026-01-31", valueUsd: 10_000 }, { date: "2026-02-28", valueUsd: 10_500 }, []);
  check("no movements: gain over the opening balance", near(p.rate, 0.05), String(p.rate));

  // A deposit the day after opening counts almost in full; one at the close barely.
  const early = periodReturn({ date: "2026-01-31", valueUsd: 10_000 }, { date: "2026-02-28", valueUsd: 20_500 }, [
    { date: "2026-02-01", amountUsd: 10_000 },
  ]);
  const late = periodReturn({ date: "2026-01-31", valueUsd: 10_000 }, { date: "2026-02-28", valueUsd: 20_500 }, [
    { date: "2026-02-28", amountUsd: 10_000 },
  ]);
  check("same gain either way", early.gainUsd === 500 && late.gainUsd === 500);
  check("an early deposit dilutes the rate", early.rate! < 0.026 && early.rate! > 0.025, String(early.rate));
  check("a deposit on the close day does not", near(late.rate, 0.05), String(late.rate));
}

section("movimientos fuera del período");
{
  const p = periodReturn({ date: "2026-01-31", valueUsd: 100 }, { date: "2026-02-28", valueUsd: 100 }, [
    { date: "2026-01-31", amountUsd: 50 },
    { date: "2026-03-01", amountUsd: 50 },
  ]);
  check("the opening day belongs to the previous period", p.savedUsd === 0);
  check("a movement after the close is next period's", p.gainUsd === 0);
}

section("dónde empieza");
{
  const closes = [
    { date: "2026-01-20", valueUsd: 1 },
    { date: "2026-02-28", valueUsd: 1 },
    { date: "2026-03-31", valueUsd: 1 },
  ];
  check("a close days before the first movement's month can't open", firstMeasurableClose(closes, "2026-02-01") === 1);
  check("the last day of the previous month can",
    firstMeasurableClose([{ date: "2026-01-31", valueUsd: 1 }, ...closes.slice(1)], "2026-02-03") === 0);
}

section("encadenado");
{
  const closes = [
    { date: "2026-01-31", valueUsd: 10_000 },
    { date: "2026-02-28", valueUsd: 11_000 }, // +10 %
    { date: "2026-03-31", valueUsd: 9_900 },  // −10 %
  ];
  const r = buildReturns(closes, [{ date: "2026-02-10", amountUsd: 0 }])!;
  check("rates compound, they don't add", near(r.rate, 1.1 * 0.9 - 1), String(r.rate));
  check("the gain adds", near(r.gainUsd, -100), String(r.gainUsd));
  check("one row per month", r.months.map((m) => m.month).join() === "2026-02,2026-03");
  check("cumulative rate on the last row", near(r.months[1].cumulativeRate, r.rate));

  // The 10.000 saved in March is not gain, and does not shrink the percentage.
  const withSalary = buildReturns(
    [closes[0], closes[1], { date: "2026-03-31", valueUsd: 20_900 }],
    [{ date: "2026-03-01", amountUsd: 10_000 }]
  )!;
  // The first movement is in March, so the measure opens at February's close.
  check("opens at the close before the first movement's month", withSalary.startDate === "2026-02-28");
  check("savings stay out of the gain", near(withSalary.gainUsd, -100), String(withSalary.gainUsd));
  check("savings are reported apart", withSalary.savedUsd === 10_000);
}

section("dos cierres en un mes y el estimado");
{
  const r = buildReturns(
    [
      { date: "2026-01-31", valueUsd: 100 },
      { date: "2026-02-14", valueUsd: 110 },
      { date: "2026-02-28", valueUsd: 121 },
      { date: "2026-03-15", valueUsd: 121, estimate: true },
    ],
    [{ date: "2026-02-01", amountUsd: 0 }]
  )!;
  check("two closes in a month make one row", r.months.length === 2);
  check("compounded inside the month", near(r.months[0].rate, 0.21), String(r.months[0].rate));
  check("the estimate is flagged", r.estimate && r.months[1].estimate && !r.months[0].estimate);
}

section("sin datos");
{
  check("no movements, no measure", buildReturns([{ date: "2026-01-31", valueUsd: 1 }, { date: "2026-02-28", valueUsd: 1 }], []) === null);
  check("one close is not a period", buildReturns([{ date: "2026-02-28", valueUsd: 1 }], [{ date: "2026-02-02", amountUsd: 1 }]) === null);
  const empty = periodReturn({ date: "2026-01-31", valueUsd: 0 }, { date: "2026-02-28", valueUsd: 0 }, []);
  check("no capital at work: no rate", empty.rate === null);
}

console.log(`\n${pass} ok, ${fail} failed`);
if (fail) process.exit(1);
