"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { Icon } from "./Icon";
import { Button, ui as s } from "./index";

/* ---------- <html> data attributes as external stores ---------- */

function subscribeHtml(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-money"] });
  return () => observer.disconnect();
}

function useHtmlAttr(name: "money", fallback: string) {
  return useSyncExternalStore(
    subscribeHtml,
    () => document.documentElement.dataset[name] ?? fallback,
    () => fallback
  );
}

/**
 * Runs a DOM change as a view transition when the browser supports it, so a
 * theme or visibility switch cross-fades instead of snapping.
 */
export function withViewTransition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition || reduce) return update();
  doc.startViewTransition(() => flushSync(update));
}

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private windows and blocked storage: the choice still applies to this page.
  }
}

/* ---------- Money visibility ---------- */

export function useMoneyHidden() {
  return useHtmlAttr("money", "shown") === "hidden";
}

export function setMoneyHidden(hidden: boolean) {
  const root = document.documentElement;
  if (hidden) root.dataset.money = "hidden";
  else delete root.dataset.money;
  persist("platita-show-money", String(!hidden));
}

export function MoneyToggle({ withLabel = false }: { withLabel?: boolean }) {
  const hidden = useMoneyHidden();
  return (
    <Button
      variant="ghost"
      size={withLabel ? "md" : "sm"}
      iconOnly={!withLabel}
      onClick={() => withViewTransition(() => setMoneyHidden(!hidden))}
      aria-pressed={hidden}
      aria-label={hidden ? "Mostrar montos" : "Ocultar montos"}
      title={hidden ? "Mostrar montos" : "Ocultar montos"}
    >
      <Icon name={hidden ? "eyeOff" : "eye"} size={20} />
      {withLabel && (hidden ? "Mostrar montos" : "Ocultar montos")}
    </Button>
  );
}

/* ---------- Theme ---------- */

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const value = mounted ? theme ?? "light" : "light";
  const options = [
    { value: "light", label: "Claro" },
    { value: "dark", label: "Oscuro" },
    { value: "system", label: "Sistema" },
  ];
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const choose = (next: string) =>
    withViewTransition(() => {
      // Applied by hand inside the transition so the new frame already has it;
      // next-themes would otherwise set the class a tick later, after the snapshot.
      const dark = next === "dark" || (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.classList.toggle("light", !dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
      setTheme(next);
    });
  return (
    <div
      className={s.segmented}
      role="group"
      aria-label="Apariencia"
      style={{ "--seg-n": options.length, "--seg-i": index } as CSSProperties}
    >
      <span className={s.segThumb} aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={s.segButton}
          aria-pressed={value === o.value}
          onClick={() => choose(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Sheet (native <dialog>) ---------- */

/**
 * A bottom sheet on the phone and a centred modal from 760px up. Built on
 * <dialog> + showModal, which brings focus trapping, Esc and the backdrop
 * for free.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  narrow,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  narrow?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // The content stays mounted until the closing animation ends, so the sheet
  // slides away with its form instead of emptying first.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal focuses the first control (the close button); a form that
      // asks for it gets its main field instead.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) {
      dialog.close();
      const t = window.setTimeout(() => setMounted(false), 320);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${s.dialog} ${narrow ? s.dialogNarrow : ""}`}
      aria-label={title}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click whose target is the dialog itself landed on the backdrop.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {mounted && (
        <div className={s.dialogInner}>
          <div className={s.dialogGrip} aria-hidden="true" />
          <div className={s.dialogHead}>
            <h2 className="h3">{title}</h2>
            <Button variant="ghost" size="sm" iconOnly onClick={onClose} aria-label="Cerrar">
              <Icon name="close" size={20} />
            </Button>
          </div>
          <div className={s.dialogBody}>{children}</div>
        </div>
      )}
    </dialog>
  );
}

/* ---------- Confirm ---------- */

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Eliminar",
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} narrow>
      <div className={s.stack}>
        <p className="muted">{message}</p>
        <div className={s.actions}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
