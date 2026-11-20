import Link from "next/link";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { formatMoney, formatPercent, type MoneyOptions } from "@/lib/utils/format";
import type { Currency } from "@/lib/constants/currencies";
import s from "./ui.module.css";

export { s as ui };

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

/* ---------- Button ---------- */

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "text";
type Size = "sm" | "md" | "lg";

interface ButtonOwnProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  iconOnly?: boolean;
  loading?: boolean;
}

function buttonClass({ variant = "primary", size = "md", block, iconOnly }: ButtonOwnProps, extra?: string) {
  return cx(s.button, s[variant], size !== "md" && s[size], block && s.block, iconOnly && s.iconOnly, extra);
}

export function Button({
  variant,
  size,
  block,
  iconOnly,
  loading,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonOwnProps & ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, block, iconOnly }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className={s.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  block,
  iconOnly,
  className,
  ...props
}: ButtonOwnProps & ComponentProps<typeof Link>) {
  return <Link className={buttonClass({ variant, size, block, iconOnly }, className)} {...props} />;
}

/* ---------- Badge ---------- */

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "dark" | "accent" | "up" | "down";
  children: ReactNode;
}) {
  return <span className={cx(s.badge, s[`badge_${tone}`])}>{children}</span>;
}

/* ---------- Eyebrow: the small label above a figure or a section ---------- */

export function LineLabel({ children, as: Tag = "p" }: { children: ReactNode; as?: "p" | "span" | "h2" | "h3" }) {
  return <Tag className={s.lineLabel}>{children}</Tag>;
}

/* ---------- Money ---------- */

/**
 * An amount that honours "ocultar montos". Server-safe: the hidden state is a
 * CSS switch on `<html>`, so nothing here needs a hook.
 */
export function Money({
  value,
  currency = "ARS",
  className,
  ...options
}: { value: number; currency?: Currency; className?: string } & MoneyOptions) {
  return (
    <span className={className}>
      <span className="money-value">{formatMoney(value, currency, options)}</span>
      <span className="money-mask" aria-label="Monto oculto">
        ••••••
      </span>
    </span>
  );
}

/* ---------- Delta: ▲ 3,2 % ---------- */

/**
 * A change, with its direction carried by the triangle as well as the colour.
 * `goodWhen` says which direction is good news: spending going up is not.
 */
export function Delta({
  value,
  goodWhen = "up",
  suffix,
}: {
  value: number | null | undefined;
  goodWhen?: "up" | "down";
  suffix?: string;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const flat = Math.abs(value) < 0.05;
  const up = value > 0;
  const good = flat ? null : goodWhen === "up" ? up : !up;
  return (
    <span className={cx(s.delta, flat ? s.delta_flat : good ? s.delta_good : s.delta_bad)}>
      <span aria-hidden="true">{flat ? "=" : up ? "▲" : "▼"}</span>
      <span className="visually-hidden">{flat ? "sin cambios" : up ? "sube" : "baja"}</span>
      {formatPercent(Math.abs(value), { signed: false })}
      {suffix && <span className="muted"> {suffix}</span>}
    </span>
  );
}

/* ---------- Box (info box) ---------- */

export function Box({
  tone = "grey",
  className,
  children,
  as: Tag = "div",
  ...props
}: {
  tone?: "white" | "grey" | "blue" | "up" | "down" | "black";
  as?: "div" | "section" | "article";
} & ComponentProps<"div">) {
  return (
    <Tag className={cx(s.box, s[`box_${tone}`], className)} {...props}>
      {children}
    </Tag>
  );
}

/* ---------- Section ---------- */

export function Section({
  label,
  title,
  aside,
  children,
  id,
}: {
  label?: string;
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className={s.section} id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      {(label || title || aside) && (
        <div className={s.sectionHead}>
          <div className={s.sectionTitle}>
            {label && <LineLabel>{label}</LineLabel>}
            {title && (
              <h2 className="h2" id={id ? `${id}-title` : undefined}>
                {title}
              </h2>
            )}
          </div>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/* ---------- Fields ---------- */

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className={s.error} role="alert">
          {error}
        </p>
      ) : (
        hint && <p className={s.hint}>{hint}</p>
      )}
    </div>
  );
}

export function Input({ className, amount, ...props }: ComponentProps<"input"> & { amount?: boolean }) {
  return <input className={cx(s.control, amount && s.amount, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(s.control, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(s.control, className)} {...props} />;
}

/**
 * Pill segmented control built from radios, so a form reads it through
 * FormData with no state at all.
 */
export function SegmentedRadio({
  name,
  options,
  defaultValue,
  block,
  label,
}: {
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  block?: boolean;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(s.segmented, block && s.segmentedBlock)}
      style={{ "--seg-n": options.length } as CSSProperties}
    >
      <span className={s.segThumb} aria-hidden="true" />
      {options.map((o) => (
        <label key={o.value} className={s.segItem}>
          <input type="radio" name={name} value={o.value} defaultChecked={o.value === defaultValue} />
          <span className={s.segLabel}>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

/* ---------- Empty state ---------- */

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className={s.empty}>
      <p className="h3">{title}</p>
      {text && <p className={s.emptyText}>{text}</p>}
      {action}
    </div>
  );
}

/* ---------- Skeleton ---------- */

export function Skeleton({ height, width = "100%", radius }: { height: number | string; width?: number | string; radius?: number }) {
  return <div className={s.skeleton} style={{ height, width, borderRadius: radius }} aria-hidden="true" />;
}

export function Stack({ gap = 20, children, className }: { gap?: number; children: ReactNode; className?: string }) {
  return (
    <div className={cx(s.stack, className)} style={{ gap }}>
      {children}
    </div>
  );
}
