import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "danger" | "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  danger:
    "border border-red-700 bg-red-700 !text-white shadow-sm hover:bg-red-800 hover:!text-white focus-visible:ring-red-700",
  primary:
    "border border-primary bg-primary !text-white shadow-sm hover:bg-primary-strong hover:!text-white focus-visible:ring-primary",
  secondary:
    "border border-border bg-surface text-primary hover:border-primary/30 hover:bg-primary-soft focus-visible:ring-primary",
  ghost: "text-primary hover:bg-primary-soft focus-visible:ring-primary",
};

export function Button({
  children,
  className = "",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center rounded-control px-5 py-2.5 text-sm font-semibold transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 ${variantClasses[variant]} ${className}`}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
