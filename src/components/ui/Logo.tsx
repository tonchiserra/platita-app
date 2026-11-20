import s from "./ui.module.css";

/** The original Platita logo. In dark mode a filter lifts its blue for the dark ground. */
export function Logo({ height = 28 }: { height?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- an SVG, already sized; next/image adds nothing
    <img src="/platita-logo.svg" alt="Platita" width={Math.round((height * 437) / 112)} height={height} className={s.logo} />
  );
}
