import type { LucideIcon } from 'lucide-react';

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  icons?: Record<T, LucideIcon>;
  /** Options are storage zones: the active one takes that zone's colour. */
  zoned?: boolean;
  onChange: (value: T) => void;
}

/** A row of mutually exclusive buttons; faster than a <select> when there are few options. */
export function Segmented<T extends string>({ label, value, options, labels, icons, zoned = false, onChange }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const Icon: LucideIcon | undefined = icons?.[option];
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            className={`segment ${value === option ? 'segment-active' : ''}`}
            data-zone={zoned ? option : undefined}
            onClick={() => onChange(option)}
          >
            {Icon && <Icon aria-hidden size={18} />}
            {labels[option]}
          </button>
        );
      })}
    </div>
  );
}
