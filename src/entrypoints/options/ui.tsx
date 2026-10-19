import type { ComponentChildren } from 'preact';
import { Icon, type IconName } from '@/components/Icon';

export function Section({
  id,
  icon,
  title,
  description,
  children,
}: {
  id: string;
  icon: IconName;
  title: string;
  description?: string;
  children: ComponentChildren;
}) {
  return (
    <section id={id} class="scroll-mt-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm dark:border-ink-800 dark:bg-ink-850">
      <header class="mb-4 flex items-start gap-3">
        <span class="rounded-xl bg-brand-50 p-2 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
          <Icon name={icon} size={18} />
        </span>
        <div>
          <h2 class="text-base font-semibold">{title}</h2>
          {description && <p class="mt-0.5 text-sm text-ink-500 dark:text-ink-400">{description}</p>}
        </div>
      </header>
      <div class="space-y-4">{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: ComponentChildren;
  hint?: ComponentChildren;
  children: ComponentChildren;
  htmlFor?: string;
}) {
  return (
    <div>
      <label for={htmlFor} class="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p class="mt-1 text-xs text-ink-500 dark:text-ink-400">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200 dark:border-ink-700 dark:bg-ink-900 dark:focus:border-brand-500 dark:focus:ring-brand-900';

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  type = 'button',
  title,
}: {
  children: ComponentChildren;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  type?: 'button' | 'submit';
  title?: string;
}) {
  const styles = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
    secondary: 'border border-ink-200 bg-white hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:hover:bg-ink-800',
    danger: 'border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950',
    ghost: 'text-ink-500 hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-ink-800 dark:hover:text-white',
  };
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      class={`inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none disabled:opacity-50 ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'off'; children: ComponentChildren }) {
  const styles = {
    ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    warn: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    off: 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400',
  };
  return <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[tone]}`}>{children}</span>;
}

export function RadioCard({
  checked,
  onSelect,
  title,
  description,
  name,
}: {
  checked: boolean;
  onSelect: () => void;
  title: ComponentChildren;
  description?: ComponentChildren;
  name: string;
}) {
  return (
    <label
      class={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
        checked
          ? 'border-brand-500 bg-brand-50/60 dark:border-brand-400 dark:bg-brand-900/20'
          : 'border-ink-200 hover:border-brand-300 dark:border-ink-700'
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} class="mt-0.5 accent-brand-600" />
      <span>
        <span class="block text-sm font-medium">{title}</span>
        {description && <span class="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">{description}</span>}
      </span>
    </label>
  );
}
