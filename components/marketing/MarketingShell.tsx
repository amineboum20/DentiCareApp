import type { ReactNode } from "react";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

// Frame of every public marketing page: font, top bar, footer.
export default function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="v2-font min-h-full flex flex-col bg-white text-slate-900 leading-relaxed antialiased">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
