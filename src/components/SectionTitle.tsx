import type { ReactNode } from "react";

type SectionTitleProps = {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  align?: "center" | "left";
};

export function SectionTitle({
  eyebrow,
  title,
  children,
  align = "center",
}: SectionTitleProps) {
  return (
    <div
      className={`max-w-3xl space-y-4 ${
        align === "center" ? "mx-auto text-center" : "text-left"
      }`}
    >
      {eyebrow ? (
        <p className="text-small font-semibold uppercase tracking-[0.14em] text-secondary">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-h2 font-semibold text-text">{title}</h2>
      {children ? <p className="text-body leading-relaxed text-muted">{children}</p> : null}
    </div>
  );
}
