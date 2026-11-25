export function Chips({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  if (options.length === 0) return null;
  return (
    <fieldset>
      <legend className="mb-2 text-sm text-muted">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = selected.includes(option);
          return (
            <button
              key={option || "empty"}
              type="button"
              aria-pressed={on}
              className={`border px-2 py-1 text-xs ${on ? "border-yellow bg-yellow/10 text-yellow" : "border-line text-muted"}`}
              onClick={() => onChange(on ? selected.filter((value) => value !== option) : [...selected, option])}
            >
              {option || "—"}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
