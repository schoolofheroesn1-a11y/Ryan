import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

type Common = { label: string; name: string; error?: string; hint?: ReactNode; required?: boolean };

export function TextField({ label, name, error, hint, required, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = rest.id ?? `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label} {required && <span className="text-danger" aria-hidden>*</span>}
      </label>
      <input
        id={id}
        name={name}
        className="input"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        required={required}
        {...rest}
      />
      {hint && !error && <p id={`${id}-hint`} className="hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="field-error">{error}</p>}
    </div>
  );
}

export function TextArea({ label, name, error, hint, required, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = rest.id ?? `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label} {required && <span className="text-danger" aria-hidden>*</span>}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rest.rows ?? 4}
        className="input leading-relaxed"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
      {hint && !error && <p id={`${id}-hint`} className="hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="field-error">{error}</p>}
    </div>
  );
}

export function CheckboxGroup({
  legend,
  name,
  options,
  selected,
  error,
  hint,
  required,
  type = "checkbox",
}: {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  selected: string[];
  error?: string;
  hint?: string;
  required?: boolean;
  type?: "checkbox" | "radio";
}) {
  return (
    <fieldset aria-invalid={!!error} aria-describedby={error ? `g-${name}-error` : undefined}>
      <legend className="label">
        {legend} {required && <span className="text-danger" aria-hidden>*</span>}
      </legend>
      {hint && <p className="hint -mt-1 mb-2">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="chip cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40">
            <input type={type} name={name} value={o.value} defaultChecked={selected.includes(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
      {error && <p id={`g-${name}-error`} className="field-error">{error}</p>}
    </fieldset>
  );
}
