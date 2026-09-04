"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useState, useEffect } from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const patients = [
  { name: "Amina Ziani", phone: "06 12 34 56 78", dob: "12/03/1985", lastVisit: "14/07/2025", next: "20/09/2025" },
  { name: "Youssef Benali", phone: "07 98 76 54 32", dob: "05/11/1972", lastVisit: "02/06/2025", next: "—" },
  { name: "Sara Lahlou", phone: "06 55 44 33 22", dob: "28/02/1990", lastVisit: "18/08/2025", next: "01/10/2025" },
  { name: "Rachid Moumen", phone: "07 11 22 33 44", dob: "14/07/1968", lastVisit: "10/08/2025", next: "10/11/2025" },
  { name: "Fatima Chraibi", phone: "06 66 77 88 99", dob: "30/09/1995", lastVisit: "01/08/2025", next: "15/09/2025" },
];

const appointments = [
  { time: "09:00", patient: "Amina Ziani",    type: "Détartrage",   duration: "30 min" },
  { time: "10:00", patient: "Nouveau patient", type: "Consultation", duration: "20 min" },
  { time: "11:30", patient: "Youssef Benali",  type: "Obturation",   duration: "45 min" },
  { time: "14:00", patient: "Sara Lahlou",     type: "Contrôle",     duration: "15 min" },
  { time: "15:30", patient: "Rachid Moumen",   type: "Extraction",   duration: "30 min" },
];

const traitements = [
  { name: "Détartrage", category: "Nettoyage", price: "400 MAD", duration: "30 min" },
  { name: "Obturation composite", category: "Obturation", price: "600 MAD", duration: "45 min" },
  { name: "Extraction simple", category: "Extraction", price: "800 MAD", duration: "30 min" },
  { name: "Couronne céramique", category: "Couronne", price: "3500 MAD", duration: "2 séances" },
  { name: "Implant dentaire", category: "Implant", price: "8000 MAD", duration: "3 mois" },
  { name: "Blanchiment", category: "Blanchiment", price: "2000 MAD", duration: "60 min" },
];

const factures = [
  { id: "#0142", patient: "Amina Ziani",   traitement: "Détartrage + radiographie", status: "Payée",    date: "20/08/2025" },
  { id: "#0141", patient: "Youssef Benali", traitement: "Obturation composite ×2",   status: "En cours", date: "18/08/2025" },
  { id: "#0140", patient: "Sara Lahlou",   traitement: "Couronne céramique",         status: "Payée",    date: "10/08/2025" },
  { id: "#0139", patient: "Rachid Moumen", traitement: "Consultation + radio OPG",   status: "En attente", date: "05/08/2025" },
];

const statusColor: Record<string, string> = {
  "Payée":      "bg-emerald-100 text-emerald-700",
  "En cours":   "bg-teal-100 text-teal-700",
  "Annulée":    "bg-zinc-100 text-zinc-500",
  "En attente": "bg-amber-100 text-amber-700",
};

function ModalContent({ featureKey }: { featureKey: string }) {
  switch (featureKey) {
    case "patients":
      return (
        <div className="overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            <input placeholder="Rechercher…" className="text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 focus:outline-none w-48" />
            <button className="text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg">+ Nouveau patient</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                {["Nom", "Téléphone", "Date naiss.", "Dernière visite", "Prochain RDV"].map(h => <th key={h} className="pb-2 font-medium pr-4">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.name} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer">
                  <td className="py-2.5 pr-4 font-medium text-zinc-900 dark:text-white">{p.name}</td>
                  <td className="py-2.5 pr-4 text-zinc-500">{p.phone}</td>
                  <td className="py-2.5 pr-4 text-zinc-500">{p.dob}</td>
                  <td className="py-2.5 pr-4 text-zinc-500">{p.lastVisit}</td>
                  <td className="py-2.5 text-zinc-500">{p.next}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "dossiers":
      return (
        <div className="flex flex-col gap-3">
          {[
            { patient: "Amina Ziani", type: "Examen", date: "14/07/2025", notes: "Détartrage effectué. Légère gingivite observée.", next: "14/01/2026" },
            { patient: "Youssef Benali", type: "Soin", date: "02/06/2025", notes: "Obturation composite dent 36. Anesthésie locale.", next: "02/12/2025" },
          ].map((d) => (
            <div key={d.patient} className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-sm text-zinc-900 dark:text-white">{d.patient}</p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">{d.type}</span>
              </div>
              <p className="text-xs text-zinc-400 mb-1">{d.date} · Prochain: {d.next}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-300">{d.notes}</p>
            </div>
          ))}
        </div>
      );
    case "traitements":
      return (
        <div className="grid grid-cols-2 gap-3">
          {traitements.map((t) => (
            <div key={t.name} className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-3">
              <p className="font-semibold text-sm text-zinc-900 dark:text-white">{t.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{t.category} · {t.duration}</p>
              <p className="text-sm font-semibold text-teal-600 mt-2">{t.price}</p>
            </div>
          ))}
        </div>
      );
    case "factures":
      return (
        <div className="flex flex-col gap-2">
          {factures.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-xl border border-zinc-100 dark:border-zinc-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 font-mono">{f.id}</span>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{f.patient}</p>
                  <p className="text-xs text-zinc-500">{f.traitement}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[f.status]}`}>{f.status}</span>
                <span className="text-xs text-zinc-400">{f.date}</span>
              </div>
            </div>
          ))}
        </div>
      );
    case "appointments":
      return (
        <div className="flex flex-col gap-2">
          {appointments.map((a) => (
            <div key={a.time} className="flex items-center gap-4 rounded-xl border border-zinc-100 dark:border-zinc-800 px-4 py-3">
              <span className="text-sm font-mono text-teal-600 dark:text-teal-400 w-12 shrink-0">{a.time}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">{a.patient}</p>
                <p className="text-xs text-zinc-500">{a.type}</p>
              </div>
              <span className="text-xs text-zinc-400">{a.duration}</span>
            </div>
          ))}
        </div>
      );
    case "reports":
      const months = ["Mar", "Avr", "Mai", "Jun", "Jul", "Aoû"];
      const values = [38, 52, 45, 61, 58, 73];
      const max = Math.max(...values);
      return (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "CA (Août)", value: "42 800 MAD", trend: "+14%", up: true },
              { label: "Factures", value: "47", trend: "+8%", up: true },
              { label: "Nouveaux patients", value: "18", trend: "+5%", up: true },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-3">
                <p className="text-xs text-zinc-400">{s.label}</p>
                <p className="text-xl font-bold text-zinc-900 dark:text-white mt-1">{s.value}</p>
                <p className={`text-xs mt-0.5 font-medium ${s.up ? "text-green-600" : "text-red-500"}`}>{s.trend}</p>
              </div>
            ))}
          </div>
          <div className="flex items-end gap-2 h-28">
            {months.map((m, i) => (
              <div key={m} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-md bg-teal-500 opacity-80" style={{ height: `${(values[i] / max) * 100}%` }} />
                <span className="text-xs text-zinc-400">{m}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "search":
      return (
        <div>
          <input defaultValue="amina" className="w-full text-sm border border-teal-400 rounded-xl px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 focus:outline-none mb-4 ring-2 ring-teal-100 dark:ring-teal-900/30" />
          <div className="flex flex-col gap-1">
            {[
              { type: "Patient", icon: "🦷", label: "Amina Ziani", sub: "Dernière visite 14/07/2025" },
              { type: "Facture", icon: "🧾", label: "Facture #0142 — Amina Ziani", sub: "Payée · Détartrage" },
              { type: "RDV", icon: "📅", label: "RDV Amina Ziani — 20/09/2025", sub: "09:00 · Détartrage" },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer">
                <span className="text-lg">{r.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{r.label}</p>
                  <p className="text-xs text-zinc-400">{r.sub}</p>
                </div>
                <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{r.type}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "print":
      return (
        <div className="flex flex-col gap-3">
          {[
            { icon: "🧾", title: "Facture dentaire (A4)", action: "Exporter PDF" },
            { icon: "📋", title: "Dossier patient", action: "Exporter PDF" },
            { icon: "📅", title: "Planning du jour", action: "Imprimer" },
            { icon: "👥", title: "Liste des patients", action: "Exporter Excel" },
            { icon: "📊", title: "Rapport mensuel", action: "Télécharger" },
          ].map((item) => (
            <div key={item.title} className="flex items-center justify-between rounded-xl border border-zinc-100 dark:border-zinc-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xl">{item.icon}</span>
                <p className="text-sm font-medium text-zinc-900 dark:text-white">{item.title}</p>
              </div>
              <button className="text-xs border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-300">{item.action}</button>
            </div>
          ))}
        </div>
      );
    case "security":
      return (
        <div className="flex flex-col gap-4">
          {[
            { icon: "🔐", title: "Chiffrement de bout en bout", desc: "AES-256 au repos et en transit." },
            { icon: "🛡️", title: "Conformité RGPD", desc: "Serveurs EU. Droit à l'effacement supporté." },
            { icon: "👁️", title: "Journaux d'accès", desc: "Chaque connexion et accès est enregistré." },
            { icon: "📱", title: "Double authentification", desc: "SMS ou application d'authentification." },
            { icon: "💾", title: "Sauvegardes quotidiennes", desc: "Snapshots automatiques pendant 30 jours." },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <span className="text-xl mt-0.5">{item.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{item.title}</p>
                  <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">✓ Actif</span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

export default function Home() {
  const t = useTranslations();
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-animate]");
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) {
          const el = e.target as HTMLElement;
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          io.unobserve(el);
        }
      }),
      { threshold: 0.1 }
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  const features = [
    { key: "patients",     icon: "🦷", title: t("features.patients.title"),     desc: t("features.patients.desc") },
    { key: "dossiers",     icon: "🗂️", title: t("features.dossiers.title"),    desc: t("features.dossiers.desc") },
    { key: "traitements",  icon: "💊", title: t("features.traitements.title"),  desc: t("features.traitements.desc") },
    { key: "factures",     icon: "🧾", title: t("features.factures.title"),     desc: t("features.factures.desc") },
    { key: "appointments", icon: "📅", title: t("features.appointments.title"), desc: t("features.appointments.desc") },
    { key: "reports",      icon: "📊", title: t("features.reports.title"),      desc: t("features.reports.desc") },
    { key: "search",       icon: "🔍", title: t("features.search.title"),       desc: t("features.search.desc") },
    { key: "print",        icon: "🖨️", title: t("features.print.title"),       desc: t("features.print.desc") },
    { key: "security",     icon: "🔒", title: t("features.security.title"),     desc: t("features.security.desc") },
  ];

  const activeFeatureData = features.find((f) => f.key === activeFeature);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🦷</span>
            <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">DentiCare</span>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <a href="#features" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">{t("nav.features")}</a>
            <a href="#how" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">{t("nav.howItWorks")}</a>
            <Link href="/signin" className="text-sm text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors">{t("nav.signIn")}</Link>
            <LanguageSwitcher />
            <Link href="/signup" className="text-sm font-medium bg-teal-600 text-white px-4 py-2 rounded-full hover:bg-teal-700 transition-colors">{t("nav.getStarted")}</Link>
          </div>
          <div className="flex sm:hidden items-center gap-2">
            <LanguageSwitcher />
            <button onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label="Toggle menu"
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                {mobileNavOpen
                  ? <><line x1="4" y1="4" x2="16" y2="16"/><line x1="16" y1="4" x2="4" y2="16"/></>
                  : <><line x1="3" y1="5" x2="17" y2="5"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="15" x2="17" y2="15"/></>}
              </svg>
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="sm:hidden border-t border-zinc-100 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 px-5 py-4 flex flex-col gap-3">
            <a href="#features" onClick={() => setMobileNavOpen(false)} className="text-sm text-zinc-700 dark:text-zinc-300 py-1">{t("nav.features")}</a>
            <a href="#how" onClick={() => setMobileNavOpen(false)} className="text-sm text-zinc-700 dark:text-zinc-300 py-1">{t("nav.howItWorks")}</a>
            <Link href="/signin" onClick={() => setMobileNavOpen(false)} className="text-sm text-zinc-700 dark:text-zinc-300 py-1">{t("nav.signIn")}</Link>
            <Link href="/signup" className="text-sm font-medium bg-teal-600 text-white px-4 py-2.5 rounded-full text-center hover:bg-teal-700 transition-colors">{t("nav.getStarted")}</Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-6"
        style={{
          minHeight: "calc(100vh - 76px)",
          backgroundImage: "url('/pexels-shvets-production-8413334.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/45 to-black/70" />
        <div className="relative z-10 flex flex-col items-center">
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-white/80 bg-white/10 border border-white/20 backdrop-blur-sm rounded-full px-3 py-1 mb-6">
            ✦ {t("hero.badge")}
          </span>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-white max-w-3xl leading-tight">
            {t("hero.title")}{" "}
            <span className="text-teal-400">{t("hero.titleHighlight")}</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-white/65 max-w-xl leading-relaxed">{t("hero.subtitle")}</p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 items-center">
            <Link href="/signup" className="px-8 py-3.5 rounded-full bg-teal-600 text-white font-semibold hover:bg-teal-500 transition-colors shadow-xl shadow-teal-900/50">{t("hero.cta")}</Link>
            <a href="#features" className="px-8 py-3.5 rounded-full border border-white/25 text-white font-medium hover:bg-white/10 backdrop-blur-sm transition-colors">{t("hero.ctaSecondary")}</a>
          </div>
          <p className="mt-5 text-sm text-white/40">{t("hero.noCreditCard")}</p>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="w-6 h-10 rounded-full border-2 border-white/25 flex items-start justify-center pt-2">
            <div className="w-1 h-2 bg-white/50 rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* Mock dashboard */}
      <section className="py-20 px-6 bg-white dark:bg-zinc-950">
        <div data-animate style={{ opacity: 0, transform: "translateY(28px)", transition: "opacity 0.7s ease, transform 0.7s ease" }} className="max-w-4xl mx-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <span className="w-3 h-3 rounded-full bg-red-400" /><span className="w-3 h-3 rounded-full bg-yellow-400" /><span className="w-3 h-3 rounded-full bg-green-400" />
            <span className="ml-4 text-xs text-zinc-400">denticare.vercel.app/dashboard</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-6">
            {[
              { label: t("stats.totalPatients"), value: "184", icon: "🦷", trend: "+12", trendLabel: t("stats.thisMonth"), up: true },
              { label: t("stats.facturesMonth"), value: "38", icon: "🧾", trend: "+8%", trendLabel: t("stats.vsLastMonth"), up: true },
              { label: t("stats.appointmentsToday"), value: "9", icon: "📅", trend: "3", trendLabel: t("stats.days"), up: true },
              { label: t("stats.pendingPayments"), value: "5", icon: "⏳", trend: "2", trendLabel: t("stats.overdue"), up: false },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 text-left">
                <span className="text-xl">{s.icon}</span>
                <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{s.value}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{s.label}</div>
                <div className={`mt-1.5 text-xs font-medium ${s.up ? "text-green-600" : "text-amber-500"}`}>
                  {s.trend} <span className="text-zinc-400 font-normal">{s.trendLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Device mockups — desktop only */}
      <section className="hidden lg:block py-20 px-6 bg-zinc-50 dark:bg-zinc-900 overflow-hidden">
        <div data-animate style={{ opacity: 0, transform: "translateY(40px)", transition: "opacity 0.8s ease, transform 0.8s ease" }} className="max-w-6xl mx-auto flex items-end justify-center gap-12 lg:gap-24">

          {/* Phone — 110×220px */}
          <div className="hidden md:flex flex-shrink-0 mb-14">
            <div className="bg-zinc-600 rounded-[2rem] p-[5px] shadow-2xl shadow-black/30" style={{width:110}}>
              <div className="mx-auto w-9 h-[10px] bg-zinc-950 rounded-full mt-1 mb-1" />
              <div className="bg-zinc-950 rounded-[1.4rem] overflow-hidden" style={{height:220}}>
                <div className="p-2">
                  <p className="text-white text-[9px] font-semibold mb-1.5">Aujourd&apos;hui</p>
                  {[
                    {time:"09:00",name:"Amina Z.",type:"Détartrage"},
                    {time:"10:00",name:"Nouveau",type:"Consultation"},
                    {time:"11:30",name:"Youssef B.",type:"Obturation"},
                    {time:"14:00",name:"Sara L.",type:"Contrôle"},
                    {time:"15:30",name:"Rachid M.",type:"Extraction"},
                  ].map(a => (
                    <div key={a.time} className="flex items-center gap-1 py-1 border-b border-zinc-800/80">
                      <span className="text-teal-400 font-mono text-[7px] w-8 shrink-0">{a.time}</span>
                      <div>
                        <p className="text-white text-[8px] font-medium leading-tight">{a.name}</p>
                        <p className="text-zinc-500 text-[7px]">{a.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mx-auto w-8 h-1 bg-zinc-500 rounded-full mt-1.5" />
            </div>
          </div>

          {/* Laptop — center, largest */}
          <div className="flex-1 min-w-0 max-w-[600px]">
            <div className="bg-zinc-600 rounded-t-xl p-[7px] shadow-2xl shadow-black/40">
              <div className="bg-zinc-950 rounded-lg overflow-hidden" style={{aspectRatio:"16/10"}}>
                <div className="h-7 bg-zinc-900 border-b border-zinc-800 flex items-center px-3 gap-1.5 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  <div className="ml-2 flex-1 bg-zinc-800 rounded text-[10px] text-zinc-400 px-2 py-0.5 text-center max-w-[180px] mx-auto truncate">denticare.vercel.app/dashboard</div>
                </div>
                <div className="flex" style={{height:"calc(100% - 28px)"}}>
                  <div className="w-12 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-3 gap-3 shrink-0">
                    <span className="text-base">🦷</span>
                    {["👤","🗂️","💊","🧾","📅","📊"].map((icon,i) => (
                      <div key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${i===0?"bg-teal-600":""}`}>{icon}</div>
                    ))}
                  </div>
                  <div className="flex-1 p-3 overflow-hidden">
                    <p className="text-white text-xs font-semibold mb-2">Dashboard</p>
                    <div className="grid grid-cols-4 gap-1.5 mb-3">
                      {[{l:"Patients",v:"184",c:"text-teal-400"},{l:"Factures",v:"38",c:"text-green-400"},{l:"RDV",v:"9",c:"text-purple-400"},{l:"Attente",v:"5",c:"text-amber-400"}].map(s=>(
                        <div key={s.l} className="bg-zinc-800 rounded-lg p-2">
                          <p className={`text-[8px] ${s.c} mb-0.5`}>{s.l}</p>
                          <p className="text-white text-sm font-bold">{s.v}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-2.5">
                      <p className="text-zinc-400 text-[9px] mb-2">CA mensuel</p>
                      <div className="flex items-end gap-1" style={{height:52}}>
                        {[38,52,45,61,58,73,65].map((h,i)=>(
                          <div key={i} className="flex-1 bg-teal-600 rounded-t opacity-80" style={{height:`${(h/73)*100}%`}} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mx-auto bg-zinc-500 h-[6px] rounded-b-sm" style={{width:"102%"}} />
            <div className="mx-auto bg-zinc-500 h-[10px] rounded-b-lg" style={{width:"55%"}} />
          </div>

          {/* Tablet — 290×400px */}
          <div className="hidden lg:flex flex-shrink-0 mb-6">
            <div className="bg-zinc-600 rounded-[2rem] p-[6px] shadow-2xl shadow-black/30" style={{width:290}}>
              <div className="w-3 h-3 bg-zinc-500 rounded-full mx-auto my-2" />
              <div className="bg-zinc-950 rounded-2xl overflow-hidden" style={{height:400}}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-white text-xs font-semibold">Patients</p>
                    <div className="bg-teal-600 text-white text-[9px] px-2 py-1 rounded-md">+ Nouveau</div>
                  </div>
                  {[
                    {name:"Amina Ziani",date:"14/07/2025"},
                    {name:"Youssef Benali",date:"02/06/2025"},
                    {name:"Sara Lahlou",date:"18/08/2025"},
                    {name:"Rachid Moumen",date:"10/08/2025"},
                    {name:"Fatima Chraibi",date:"01/08/2025"},
                    {name:"Karim Bensalem",date:"22/07/2025"},
                  ].map(c=>(
                    <div key={c.name} className="flex items-center gap-2.5 py-2 border-b border-zinc-800">
                      <div className="w-7 h-7 rounded-full bg-teal-900 flex items-center justify-center text-[10px] text-teal-300 shrink-0">{c.name[0]}</div>
                      <div>
                        <p className="text-white text-[11px] font-medium leading-tight">{c.name}</p>
                        <p className="text-zinc-500 text-[9px]">{c.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mx-auto w-12 h-1.5 bg-zinc-500 rounded-full mt-2.5" />
            </div>
          </div>

        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto w-full px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">{t("features.sectionTitle")}</h2>
          <p className="mt-3 text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto">{t("features.sectionSubtitle")}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <button key={f.key} onClick={() => setActiveFeature(f.key)}
              data-animate
              style={{ opacity: 0, transform: "translateY(28px)", transition: "opacity 0.6s ease, transform 0.6s ease", transitionDelay: `${i * 70}ms` }}
              className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6 flex flex-col gap-3 hover:-translate-y-2 hover:shadow-[0_8px_32px_rgba(148,163,184,0.2)] transition-[transform,box-shadow] duration-200 text-left group cursor-pointer">
              <span className="text-3xl">{f.icon}</span>
              <h3 className="font-semibold text-zinc-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">{f.title}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{f.desc}</p>
              <span className="text-xs text-teal-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">{t("features.seePreview")}</span>
            </button>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative py-24 px-6" style={{ backgroundImage: "url(/pexels-cottonbro-6502017.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10">
          <div className="max-w-4xl mx-auto text-center mb-14">
            <h2 className="text-3xl font-bold text-white">{t("howItWorks.title")}</h2>
            <p className="mt-3 text-white/70">{t("howItWorks.subtitle")}</p>
          </div>
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: "1", title: t("howItWorks.step1Title"), desc: t("howItWorks.step1Desc") },
              { step: "2", title: t("howItWorks.step2Title"), desc: t("howItWorks.step2Desc") },
              { step: "3", title: t("howItWorks.step3Title"), desc: t("howItWorks.step3Desc") },
            ].map((s, i) => (
              <div key={s.step} data-animate style={{ opacity: 0, transform: "translateY(24px)", transition: "opacity 0.6s ease, transform 0.6s ease", transitionDelay: `${i * 120}ms` }} className="flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 rounded-full bg-teal-600 text-white font-bold text-lg flex items-center justify-center">{s.step}</div>
                <h3 className="font-semibold text-white">{s.title}</h3>
                <p className="text-sm text-white/65 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-20 px-6">
        <div data-animate style={{ opacity: 0, transform: "translateY(24px)", transition: "opacity 0.7s ease, transform 0.7s ease" }} className="max-w-2xl mx-auto text-center">
          <p className="text-xl sm:text-2xl font-medium text-zinc-700 dark:text-zinc-300 leading-relaxed italic">&ldquo;{t("testimonial.quote")}&rdquo;</p>
          <div className="mt-6 flex flex-col items-center gap-1">
            <span className="font-semibold text-zinc-900 dark:text-white">{t("testimonial.author")}</span>
            <span className="text-sm text-zinc-400">{t("testimonial.role")}</span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-teal-600 py-20 px-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-white">{t("cta.title")}</h2>
        <p className="mt-3 text-teal-100 max-w-md mx-auto">{t("cta.subtitle")}</p>
        <Link href="/signup" className="mt-8 inline-block px-8 py-3 rounded-full bg-white text-teal-600 font-semibold hover:bg-teal-50 transition-colors shadow-lg">{t("cta.button")}</Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 dark:border-zinc-800 px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
        <div className="flex items-center gap-2"><span>🦷</span><span className="font-medium text-zinc-500">DentiCare</span></div>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          <a href="#features" className="hover:text-zinc-600 transition-colors">{t("nav.features")}</a>
          <a href="#how" className="hover:text-zinc-600 transition-colors">{t("nav.howItWorks")}</a>
          <Link href="/signin" className="hover:text-zinc-600 transition-colors">{t("nav.signIn")}</Link>
          <Link href="/signup" className="hover:text-zinc-600 transition-colors">{t("nav.getStarted")}</Link>
        </div>
        <span>{t("footer.rights")}</span>
      </footer>

      {/* Feature modal */}
      {activeFeature && activeFeatureData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setActiveFeature(null)}>
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">{activeFeatureData.icon}</span>
                <h2 className="font-semibold text-zinc-900 dark:text-white">{activeFeatureData.title}</h2>
                <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full ml-1">{t("features.preview")}</span>
              </div>
              <button onClick={() => setActiveFeature(null)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors text-lg">✕</button>
            </div>
            <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
              <ModalContent featureKey={activeFeature} />
            </div>
            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <p className="text-xs text-zinc-400">{t("features.previewNote")}</p>
              <Link href="/signup" className="text-xs bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors">{t("features.getStartedFree")}</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
