"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FEATURE_PAGES } from "@/utils/marketing-pages";
import { CONTAINER, Wordmark } from "@/components/marketing/ui";

export default function MarketingFooter() {
  const t = useTranslations();
  const link = "text-slate-500 hover:text-slate-900 transition-colors";
  return (
    <footer className="border-t border-slate-200 pt-12 pb-8 text-sm">
      <div className={`${CONTAINER} grid gap-10 sm:grid-cols-3`}>
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5" dir="ltr">
            <img src="/logo.svg" alt="DentiCareApp" className="w-7 h-7" />
            <Wordmark className="text-[1.1rem]" />
          </Link>
          <p className="mt-3 text-slate-500">{t("hero.badge")}</p>
          <div className="mt-4 flex gap-4">
            <a href="https://www.instagram.com/denticareapp" target="_blank" rel="noopener noreferrer" aria-label={t("footer.instagramLabel")} className={link}>Instagram</a>
            <a href="https://www.facebook.com/denticareapp" target="_blank" rel="noopener noreferrer" aria-label={t("footer.facebookLabel")} className={link}>Facebook</a>
          </div>
        </div>
        <div>
          <p className="font-semibold text-slate-900">{t("marketing.common.features")}</p>
          <ul className="mt-3 space-y-2">
            {FEATURE_PAGES.map((p) => (
              <li key={p.slug}><Link href={`/${p.slug}`} className={link}>{t(`marketing.pages.${p.key}.navLabel`)}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold text-slate-900" dir="ltr">DentiCareApp</p>
          <ul className="mt-3 space-y-2">
            <li><Link href="/faq" className={link}>{t("marketing.pages.faq.navLabel")}</Link></li>
            <li><Link href="/contact" className={link}>{t("nav.contact")}</Link></li>
            <li><Link href="/signup" className={link}>{t("nav.getStarted")}</Link></li>
            <li><Link href="/signin" className={link}>{t("nav.signIn")}</Link></li>
          </ul>
        </div>
      </div>
      <p className={`${CONTAINER} mt-10 pt-6 border-t border-slate-200 text-slate-500 text-[0.9rem]`}>{t("footer.rights")}</p>
    </footer>
  );
}
