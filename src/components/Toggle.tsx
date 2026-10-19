import type { ComponentChildren } from 'preact';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ComponentChildren;
  description?: ComponentChildren;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <label class={`flex items-start justify-between gap-3 py-2 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span class="min-w-0">
        <span class="block text-sm font-medium">{label}</span>
        {description && <span class="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">{description}</span>}
      </span>
      <span class="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          class="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)}
        />
        <span class="h-5 w-9 rounded-full bg-ink-200 transition-colors peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400 dark:bg-ink-700 dark:peer-checked:bg-brand-500" />
        <span class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}
