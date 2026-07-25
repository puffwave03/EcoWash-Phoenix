import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Section } from "@/components/Section";
import { SectionTitle } from "@/components/SectionTitle";

export default function Home() {
  return (
    <Section className="bg-background">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.72fr]">
        <SectionTitle
          eyebrow="Design foundation"
          title="EcoWash Phoenix"
        >
          Executive luxury visual system for the public website foundation.
        </SectionTitle>

        <Card className="mx-auto w-full max-w-sm space-y-5">
          <div
            aria-label="EcoWash Phoenix logo placeholder"
            className="flex size-16 items-center justify-center rounded-logo border border-secondary/40 bg-primary text-lg font-semibold text-white"
          >
            EP
          </div>
          <div className="space-y-2">
            <h1 className="text-h3 font-semibold text-text">Public Website</h1>
            <p className="text-body text-muted">
              Global layout, typography, colors, and reusable components are in
              place.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button>Request a Demo</Button>
            <Button variant="secondary">View Structure</Button>
          </div>
        </Card>
      </div>
    </Section>
  );
}
