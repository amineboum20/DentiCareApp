"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FEATURE_PAGES } from "@/utils/marketing-pages";
import { BTN_GHOST, BTN_PRIMARY, BTN, CARD, CONTAINER, Check, Eyebrow, ICON_TILE, SectionHead, Wordmark } from "@/components/marketing/ui";

// Home page sections (MediCareApp look).
const FEATURES: { key: string; icon: string }[] = [
  { key: "patients", icon: "👤" },
  { key: "dossiers", icon: "🗂️" },
  { key: "traitements", icon: "🦷" },
  { key: "factures", icon: "🧾" },
  { key: "appointments", icon: "📅" },
  { key: "reports", icon: "📊" },
  { key: "search", icon: "🔍" },
  { key: "print", icon: "🖨️" },
  { key: "security", icon: "🔒" },
];

type Card = { icon: string; title: string; text: string };

export default function LandingV2() {
  const t = useTranslations();
  const why = t.raw("landingV2.why") as Card[];
  const heroPoints = t.raw("landingV2.heroPoints") as string[];
  const priceFeatures = t.raw("landingV2.pricingBlock.features") as string[];

  return (
    <>
      {/* Hero */}
      <section className="v2-hero-bg pt-12 pb-16 sm:pt-[72px] sm:pb-[88px]">
        <div className={`${CONTAINER} grid gap-14 items-center lg:grid-cols-[1.05fr_1fr]`}>
          <div>
            <Eyebrow>{t("hero.badge")}</Eyebrow>
            <h1 className="text-[clamp(2.1rem,4.4vw,3.4rem)] font-extrabold leading-tight tracking-tight rtl:tracking-normal">
              {t("hero.title")} <span className="v2-grad-text">{t("hero.titleHighlight")}</span>
            </h1>
            {/* Mobile: photos right after the title, so the page doesn't open on a wall of text */}
            <div className="md:hidden relative h-[210px] sm:h-[280px] mt-6" aria-hidden="true">
              <div className="v2-shadow absolute top-0 start-0 w-[64%] h-[80%] rounded-2xl overflow-hidden border-4 border-white">
                <img src="/landing-radio-dentiste.jpg" alt="" className="w-full h-full object-cover" />
              </div>
              <div className="v2-shadow absolute bottom-0 end-0 w-[54%] h-[66%] rounded-2xl overflow-hidden border-4 border-white">
                <img src="/landing-hero-soin-enfant.jpg" alt="" className="w-full h-full object-cover" />
              </div>
              <div className="v2-shadow v2-brand absolute top-[6%] end-0 bg-white border border-slate-200 px-3 py-1.5 rounded-full font-bold text-xs">
                {t("landingV2.chipStatus")}
              </div>
            </div>
            <p className="mt-6 md:mt-5 text-base sm:text-[1.15rem] text-slate-600 max-w-[560px]">{t("hero.subtitle")}</p>
            <div className="grid grid-cols-2 gap-3 my-6 sm:flex sm:flex-wrap sm:my-7">
              <Link href="/signup" className={`${BTN_PRIMARY} max-sm:px-2 max-sm:text-[13px] whitespace-nowrap`}>{t("hero.cta")}</Link>
              <a href="#features" className={`${BTN_GHOST} max-sm:px-2 max-sm:text-[13px] whitespace-nowrap`}>{t("nav.features")}</a>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm sm:text-base text-slate-600 font-medium">
              {heroPoints.map((p) => <li key={p} className="flex gap-2"><Check />{p}</li>)}
            </ul>
          </div>
          <div className="hidden md:block relative h-[360px] lg:h-[460px]" aria-hidden="true">
            <div className="v2-shadow absolute top-0 start-0 w-[66%] h-[72%] rounded-3xl overflow-hidden border-[6px] border-white">
              <img src="/landing-radio-dentiste.jpg" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="v2-shadow absolute bottom-0 end-0 w-[58%] h-[62%] rounded-3xl overflow-hidden border-[6px] border-white">
              <img src="/landing-hero-soin-enfant.jpg" alt="" className="w-full h-full object-cover" />
            </div>
            <div dir="ltr" className="v2-shadow absolute bottom-[22%] start-[4%] flex items-center gap-2 bg-white border border-slate-200 px-4 py-2.5 rounded-full">
              <img src="/logo.svg" alt="" className="h-[22px] w-auto" />
              <Wordmark />
            </div>
            <div className="v2-shadow v2-brand absolute top-[12%] end-[2%] bg-white border border-slate-200 px-4 py-2.5 rounded-full font-bold text-sm">
              {t("landingV2.chipStatus")}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 sm:py-[88px] scroll-mt-20">
        <div className={CONTAINER}>
          <SectionHead eyebrow={t("landingV2.featuresEyebrow")} title={t("features.sectionTitle")} />
          <div className="grid gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.key} className={CARD}>
                <div className={ICON_TILE}>{f.icon}</div>
                <h3 className="text-[1.1rem] font-bold">{t(`features.${f.key}.title`)}</h3>
                <p className="mt-1.5 text-slate-600">{t(`features.${f.key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Explore — the SEO feature pages */}
      <section className="py-16 sm:py-[88px] bg-[#f5f8fb]">
        <div className={CONTAINER}>
          <SectionHead eyebrow={t("landingV2.exploreEyebrow")} title={t("landingV2.exploreTitle")} lead={t("landingV2.exploreLead")} />
          <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
            {FEATURE_PAGES.map((p) => (
              <Link key={p.slug} href={`/${p.slug}`} className="v2-shadow group relative overflow-hidden bg-white border border-slate-200 rounded-[18px] p-8 flex flex-col">
                <span className="v2-grad absolute inset-x-0 top-0 h-[5px]" />
                <div className={ICON_TILE}>{p.icon}</div>
                <h3 className="text-[1.25rem] font-bold">{t(`marketing.pages.${p.key}.navLabel`)}</h3>
                <p className="mt-2 text-slate-600 flex-1">{t(`marketing.pages.${p.key}.teaser`)}</p>
                <span className="v2-brand mt-6 font-semibold group-hover:underline">{t("marketing.common.learnMore")}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-16 sm:py-[88px] scroll-mt-20">
        <div className={CONTAINER}>
          <SectionHead eyebrow={t("landingV2.howEyebrow")} title={t("howItWorks.title")} lead={t("howItWorks.subtitle")} />
          <div className="grid gap-[22px] md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className={CARD}>
                <div className="v2-grad w-11 h-11 rounded-full grid place-items-center text-white font-extrabold mb-4">{n}</div>
                <h3 className="text-[1.1rem] font-bold">{t(`howItWorks.step${n}Title`)}</h3>
                <p className="mt-1.5 text-slate-600">{t(`howItWorks.step${n}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="py-16 sm:py-[88px] bg-[#f5f8fb]">
        <div className={CONTAINER}>
          <SectionHead eyebrow={t("landingV2.whyEyebrow")} title={t("landingV2.whyTitle")} />
          <div className="grid gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
            {why.map((c) => (
              <div key={c.title} className={CARD}>
                <div className={ICON_TILE}>{c.icon}</div>
                <h3 className="text-[1.1rem] font-bold">{c.title}</h3>
                <p className="mt-1.5 text-slate-600">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 sm:py-[88px] scroll-mt-20">
        <div className={CONTAINER}>
          <SectionHead eyebrow={t("landingV2.pricingBlock.eyebrow")} title={t("landingV2.pricingBlock.title")} />
          <div className="v2-grad-border v2-shadow max-w-[460px] mx-auto rounded-3xl p-6 sm:p-9">
            <div className="text-center mb-5">
              <span className="font-bold text-slate-500 uppercase tracking-[0.08em] rtl:tracking-normal text-[0.85rem]">{t("landingV2.pricingBlock.plan")}</span>
              <div className="my-1.5 text-[1.1rem] text-slate-500" dir="ltr">
                <strong className="text-[3.4rem] font-extrabold text-slate-900">{t("landingV2.pricingBlock.amount")}</strong> {t("landingV2.pricingBlock.unit")}
              </div>
              <p className="v2-tint v2-brand inline-block mt-2 px-3.5 py-1.5 rounded-full font-semibold">{t("landingV2.pricingBlock.trial")}</p>
            </div>
            <ul className="grid gap-2.5 mb-7">
              {priceFeatures.map((f) => <li key={f} className="flex gap-2.5"><Check />{f}</li>)}
            </ul>
            <Link href="/signup" className={`${BTN_PRIMARY} w-full`}>{t("landingV2.pricingBlock.cta")}</Link>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-16 sm:py-[88px] bg-[#f5f8fb]">
        <div className={CONTAINER}>
          <SectionHead eyebrow={t("landingV2.testimonialEyebrow")} title={t("landingV2.testimonialTitle")} />
          <figure className="max-w-[720px] mx-auto bg-white border border-slate-200 rounded-[18px] p-[30px] border-s-[5px]" style={{ borderInlineStartColor: "var(--brand)" }}>
            <blockquote className="text-[1.1rem] mb-[18px]">&ldquo;{t("testimonial.quote")}&rdquo;</blockquote>
            <figcaption className="flex flex-col">
              <strong>{t("testimonial.author")}</strong>
              <span className="text-slate-500 text-[0.92rem]">{t("testimonial.role")}</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Contact / CTA */}
      <section className="v2-grad py-16 sm:py-[88px] text-white text-center">
        <div className="max-w-[720px] mx-auto px-5">
          <h2 className="text-[clamp(1.8rem,3.2vw,2.6rem)] font-bold leading-tight">{t("cta.title")}</h2>
          <p className="mt-3 text-[1.1rem] opacity-90">{t("cta.subtitle")}</p>
          <div className="flex flex-wrap justify-center gap-3 mt-7">
            <Link href="/signup" className={`${BTN} bg-white text-slate-900`}>{t("cta.button")}</Link>
            <Link href="/contact" className={`${BTN} border border-white/40 text-white`}>{t("landingV2.ctaContact")}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
