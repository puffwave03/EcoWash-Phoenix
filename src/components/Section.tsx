import type { HTMLAttributes, ReactNode } from "react";
import { Container } from "@/components/Container";

type SectionProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export function Section({ children, className = "", ...props }: SectionProps) {
  return (
    <section className={`py-section ${className}`} {...props}>
      <Container>{children}</Container>
    </section>
  );
}
