import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-card border border-border bg-surface p-5 shadow-card sm:p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
