type PinInputProps = {
  id: string;
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  enterKeyHint?: "next" | "done";
  describedBy?: string;
};

export function PinInput({
  id,
  label,
  name,
  value,
  onChange,
  autoComplete = "new-password",
  enterKeyHint = "done",
  describedBy,
}: PinInputProps) {
  const cells = Array.from({ length: 4 });

  return (
    <div className="pin-input-shell">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="pin-input-cells">
        {cells.map((_, index) => (
          <span className={`pin-input-cell ${index < value.length ? "is-filled" : ""}`} key={index}>
            {index < value.length ? <i /> : null}
          </span>
        ))}
      </div>
      <input
        aria-describedby={describedBy}
        aria-label={label}
        autoComplete={autoComplete}
        className="pin-input-native"
        enterKeyHint={enterKeyHint}
        id={id}
        inputMode="numeric"
        maxLength={4}
        minLength={4}
        name={name}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 4))}
        pattern="[0-9]{4}"
        type="password"
        value={value}
      />
    </div>
  );
}
