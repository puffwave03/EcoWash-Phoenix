import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SiteFrame } from "@/layouts/SiteFrame";

type SiteLayoutProps = {
  children: ReactNode;
};

export function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <SiteFrame footer={<Footer />} header={<Header />}>
      {children}
    </SiteFrame>
  );
}
