import { Timestamp } from "firebase/firestore";

interface FieldProps {
  label: string;
  value: string | Timestamp | null | undefined;
}

// Convert Firestore Timestamp values into readable dates.
function formatValue(value: FieldProps["value"]) {
  if (!value) {
    return "—";
  }

  if (value instanceof Timestamp) {
    return value.toDate().toLocaleString();
  }

  return value;
}

// Read-only display — a plain styled div, not a disabled <input>,
// since nothing here is an actual form control.
export default function Field({ label, value }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-zinc-500">
        {label}
      </label>

      <div className="h-9 flex items-center px-3 rounded-md border border-zinc-200 bg-zinc-50 text-sm text-zinc-900">
        {formatValue(value)}
      </div>
    </div>
  );
}