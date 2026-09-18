"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: string;
};

export function SubmitButton({ children, pendingLabel = "Saving…", disabled, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return <button {...props} disabled={disabled || pending}>{pending ? pendingLabel : children}</button>;
}
