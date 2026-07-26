import { useTranslations } from "next-intl";
import { BrandLogo } from "@/components/BrandLogo";
import { Container } from "@/components/Container";
import { Link } from "@/i18n/navigation";

const footerSections = [
  {
    title: "platform.title",
    links: [
      { href: "/", label: "platform.links.overview" },
      { href: "/#solutions", label: "platform.links.solutions" },
      { href: "/#services", label: "platform.links.services" },
    ],
  },
  {
    title: "industries.title",
    links: [
      { href: "/#industries", label: "industries.links.professionalLaundries" },
      { href: "/#industries", label: "industries.links.hotels" },
      { href: "/#industries", label: "industries.links.vacationRentals" },
    ],
  },
  {
    title: "company.title",
    links: [
      { href: "/contact", label: "company.links.contact" },
      { href: "/contact", label: "company.links.requestDemo" },
    ],
  },
] as const;

export function Footer() {
  const brand = useTranslations("common.brand");
  const footer = useTranslations("common.footer");

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
                    <li key={link.label}>
                      <Link
                        className="text-sm text-muted transition-standard hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        href={link.href}
                      >
                        {footer(link.label)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-text">
                {footer("legal.title")}
              </h3>
              <p className="text-sm leading-6 text-muted">{footer("legal.note")}</p>
            </div>
          </nav>
        </div>
      </Container>
    </footer>
  );
}
