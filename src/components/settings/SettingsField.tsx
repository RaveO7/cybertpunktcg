export function SettingsField({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs uppercase tracking-[0.14em] text-muted">{label}</span>
      <p className="mt-1 text-xs text-muted">{hint}</p>
      <select
        className="mt-2 h-12 w-full border border-line bg-background px-3 text-base outline-none focus:border-cyan"
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
