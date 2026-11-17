import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

interface FieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, children, className = '' }: FieldProps) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function NumberInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <input className="input" type="number" inputMode="decimal" step="any" min={0} {...props} />;
}

interface SelectProps<T extends string> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
}

export function Select<T extends string>({ value, options, labels, onChange, ...props }: SelectProps<T>) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value as T)} {...props}>
      {options.map((option) => (
        <option key={option} value={option}>
          {labels[option]}
        </option>
      ))}
    </select>
  );
}
