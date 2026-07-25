import { Container } from "@/components/Container";

const footerSections = [
  {
    title: "Platform",
    links: ["Overview", "Features", "Operations"],
  },
  {
    title: "Solutions",
    links: ["Hotels", "Vacation Rentals", "Laundries"],
  },
  {
    title: "Company",
    links: ["About", "Resources", "Contact"],
  },
  {
    title: "Legal",
    links: ["Privacy", "Terms", "Compliance"],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface" aria-labelledby="footer-title">
      <Container className="py-12">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div
                aria-label="EcoWash Phoenix logo placeholder"
                className="flex size-10 items-center justify-center rounded-logo border border-secondary/40 bg-primary text-sm font-semibold text-white"
              >
                EP
              </div>
              <p id="footer-title" className="text-sm font-semibold text-text">
                EcoWash Phoenix
              </p>
            </div>
            <div className="flex gap-3" aria-label="Social links">
              {["IN", "X", "YT"].map((label) => (
                <span
                  className="flex size-9 items-center justify-center rounded-control border border-border bg-background text-xs font-semibold text-muted"
                  key={label}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <nav
            className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4"
            aria-label="Footer navigation"
          >
            {footerSections.map((section) => (
              <div className="space-y-4" key={section.title}>
                <h3 className="text-sm font-semibold text-text">{section.title}</h3>
                <ul className="space-y-3">
                  {section.links.map((link) => (
                    <li key={link}>
                      <span className="text-sm text-muted">
                        {link}
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
