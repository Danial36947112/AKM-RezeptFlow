import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ArmToConfirmButtonProps {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
}

const ARM_TIMEOUT_MS = 2800;

export function ArmToConfirmButton({
  label,
  onConfirm,
  disabled,
  className,
}: ArmToConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  function handleClick() {
    if (armed) {
      clearTimeout(timeoutRef.current);
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timeoutRef.current = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS);
  }

  return (
    <Button
      type="button"
      variant={armed ? "default" : "outline"}
      size="sm"
      disabled={disabled}
      onClick={handleClick}
      className={cn(armed && "gap-1", className)}
    >
      {armed && <Check className="size-3.5" strokeWidth={2} />}
      {armed ? "Bestätigen" : label}
    </Button>
  );
}
