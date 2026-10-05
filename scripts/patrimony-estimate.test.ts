import { flowsSinceClose, closeEndsPreviousMonth } from "@/lib/utils/patrimony-estimate";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, x = "") => {
  if (c) { pass++; console.log("  ok   " + n); }
  else { fail++; console.log("  FAIL " + n + (x ? "  << " + x : "")); }
};
const section = (n: string) => console.log("\n" + n);

const rows = [
  { date: "2026-07-15", id: "jul-15" },
  { date: "2026-07-31", id: "jul-31" },
  { date: "2026-08-05", id: "aug-05" },
  { date: "2026-09-10", id: "sep-10" },
  { date: "2026-10-01", id: "oct-01" },
  { date: "2026-10-03", id: "oct-03" },
  { date: "2026-10-28", id: "oct-28" },
  { date: "2026-11-02", id: "nov-02" },
];
const ids = (r: { id: string }[]) => r.map((x) => x.id).join(",");

section("meses sin cerrar");
{
  // Last close July; today is in October; August and September never closed.
  const out = flowsSinceClose(rows, "2026-07-31", "2026-10");
  check("every movement after the close counts, not only this month's",
    ids(out) === "aug-05,sep-10,oct-01,oct-03,oct-28", ids(out));
  check("the close's own day is already in the close", !out.some((r) => r.id === "jul-31"));
  check("a movement dated in a later month has not happened yet", !out.some((r) => r.id === "nov-02"));
}

section("cierre del mes anterior: igual que antes");
{
  const out = flowsSinceClose(rows, "2026-09-30", "2026-10");
  check("only this month's movements, exactly what the estimate always used",
    ids(out) === "oct-01,oct-03,oct-28", ids(out));
}

section("cierre adelantado dentro del mes");
{
  const out = flowsSinceClose(rows, "2026-10-03", "2026-10");
  check("movements up to the close day are not counted twice",
    ids(out) === "oct-28", ids(out));
}

section("¿la ventana es exactamente el mes en curso?");
{
  check("close on the last day of last month", closeEndsPreviousMonth("2026-09-30", "2026-10"));
  check("across a year boundary", closeEndsPreviousMonth("2025-12-31", "2026-01"));
  check("february in a common year", closeEndsPreviousMonth("2026-02-28", "2026-03"));
  check("february 28th in a leap year is not its end", !closeEndsPreviousMonth("2028-02-28", "2028-03"));
  check("a close months back", !closeEndsPreviousMonth("2026-07-31", "2026-10"));
  check("a mid-month close last month", !closeEndsPreviousMonth("2026-09-15", "2026-10"));
  check("a close inside the current month", !closeEndsPreviousMonth("2026-10-03", "2026-10"));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
