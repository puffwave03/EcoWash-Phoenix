import { useTranslations } from "next-intl";
import { BrandLogo } from "@/components/BrandLogo";
import { Container } from "@/components/Container";

const footerSections = [
  {
    title: "platform.title",
    links: ["platform.links.overview", "platform.links.features", "platform.links.operations"],
  },
  {
    title: "solutions.title",
    links: ["solutions.links.hotels", "solutions.links.vacationRentals", "solutions.links.laundries"],
  },
  {
    title: "company.title",
    links: ["company.links.about", "company.links.resources", "company.links.contact"],
  },
  {
    title: "legal.title",
    links: ["legal.links.privacy", "legal.links.terms", "legal.links.compliance"],
  },
];

export function Footer() {
  const brand = useTranslations("common.brand");
  const footer = useTranslations("common.footer");
  const socialKeys = ["linkedin", "x", "youtube"];

  return (
    <footer className="border-t border-border bg-surface" aria-labelledby="footer-title">
      <Container className="py-12">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center rounded-logo border border-border bg-surface px-2 py-1">
                <BrandLogo alt="" size="footer" />
              </div>
              <p id="footer-title" className="text-sm font-semibold text-text">
                {brand("name")}
              </p>
            </div>
            <div className="flex gap-3" aria-label={footer("socialLabel")}>
              {socialKeys.map((key) => (
                <span
                  className="flex size-9 items-center justify-center rounded-control border border-border bg-background text-xs font-semibold text-muted"
                  key={key}
                >
                  {footer(`social.${key}`)}
                </span>
              ))}
            </div>
          </div>

          <nav
            className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4"
            aria-label={footer("navigationLabel")}
          >
            {footerSections.map((section) => (
              <div className="space-y-4" key={section.title}>
                <h3 className="text-sm font-semibold text-text">
                  {footer(section.title)}
                </h3>
                <ul className="space-y-3">
                  {section.links.map((link) => (
                    <li key={link}>
                      <span className="text-sm text-muted">
                        {footer(link)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </Container>
    </footer>
  );
}
