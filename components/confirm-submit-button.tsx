"use client";

import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { useFormStatus } from "react-dom";

type ConfirmSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  confirmMessage: string;
  pendingLabel?: string;
};

export function ConfirmSubmitButton({
  children,
  confirmMessage,
  pendingLabel = "Saving…",
  disabled,
  onClick,
  ...props
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented && !window.confirm(confirmMessage)) event.preventDefault();
  };

  return <button {...props} disabled={disabled || pending} onClick={handleClick}>{pending ? pendingLabel : children}</button>;
}
