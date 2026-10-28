"use client";

import { dangerButton } from "@/lib/styles";

interface ConfirmSubmitButtonProps {
  message: string;
  children: React.ReactNode;
  className?: string;
}

export function ConfirmSubmitButton({ message, children, className = dangerButton }: ConfirmSubmitButtonProps) {
  return (
    <button
      className={className}
      type="submit"
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
