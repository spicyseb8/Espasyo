import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  autoComplete: string;
  minLength?: number;
  required?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  inputClassName?: string;
  description?: ReactNode;
}

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  autoComplete,
  minLength,
  required = true,
  ariaInvalid,
  ariaDescribedBy,
  inputClassName,
  description,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="grid gap-2 text-sm font-medium">
      <label htmlFor={id}>{label}</label>
      <span className="relative block">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={event => onChange(event.target.value)}
          onBlur={onBlur}
          minLength={minLength}
          required={required}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className={`h-10 pr-11 text-sm ${inputClassName ?? ""}`}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          onClick={() => setVisible(current => !current)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </Button>
      </span>
      {description}
    </div>
  );
}
