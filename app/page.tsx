"use client";

import Link from "next/link";
import { useState } from "react";

const FEATURE_DETAILS: Record<string, { title: string; content: React.ReactNode }> = {};

const clients = [
  { name: "Marie Dubois", phone: "06 12 34 56 78", dob: "12/03/1978", lastVisit: "14/07/2025", next: "20/09/2025" },
  { name: "Paul Martin", phone: "07 98 76 54 32", dob: "05/11/1965", lastVisit: "02/06/2025", next: "—" },
  { name: "Sophie Laurent", phone: "06 55 44 33 22", dob: "28/02/1990", lastVisit: "18/08/2025", next: "01/10/2025" },
  { name: "Ahmed Benali", phone: "07 11 22 33 44", dob: "14/07/1982", lastVisit: "10/08/2025", next: "10/11/2025" },
  { name: "Isabelle Moreau", phone: "06 66 77 88 99", dob: "30/09/1995", lastVisit: "01/08/2025", next: "15/09/2025" },
];

const prescriptions = [
  { eye: "OD (Right)", sphere: "-2.50", cylinder: "-0.75", axis: "180°", addition: "+1.25", pd: "32 mm" },
  { eye: "OS (Left)", sphere: "-2.00", cylinder: "-0.50", axis: "175°", addition: "+1.25", pd: "33 mm" },
];

const frames = [
  { brand: "Ray-Ban", model: "RB5154", color: "Tortoise", stock: 4, price: "€149" },
  { brand: "Oakley", model: "OX8046", color: "Matte Black", stock: 2, price: "€189" },
  { brand: "Silhouette", model: "SPX+", color: "Gold", stock: 7, price: "€320" },
  { brand: "Lindberg", model: "Air Titanium", color: "Silver", stock: 1, price: "€450" },
  { brand: "Ray-Ban", model: "RB3447", color: "Gunmetal", stock: 0, price: "€139" },
  { brand: "Persol", model: "PO3007V", color: "Havana", stock: 3, price: "€210" },
];

const orders = [
  { id: "#0142", client: "Marie Dubois", product: "Ray-Ban RB5154 + progressives", status: "Ready", date: "20/08/2025" },
  { id: "#0141", client: "Ahmed Benali", product: "Lindberg Air + blue-light lenses", status: "In progress", date: "18/08/2025" },
  { id: "#0140", client: "Paul Martin", product: "Oakley OX8046 + single-vision", status: "Delivered", date: "10/08/2025" },
  { id: "#0139", client: "Sophie Laurent", product: "Silhouette SPX+ + transitions", status: "Ordered", date: "05/08/2025" },
  { id: "#0138", client: "Isabelle Moreau", product: "Persol PO3007V + sunglasses", status: "Delivered", date: "01/08/2025" },
];

const appointments = [
  { time: "09:00", client: "Marie Dubois", type: "Eye exam", duration: "30 min" },
  { time: "10:00", client: "New client", type: "Frame fitting", duration: "20 min" },
  { time: "11:30", client: "Ahmed Benali", type: "Pickup — order #0142", duration: "15 min" },
  { time: "14:00", client: "Sophie Laurent", type: "Eye exam", duration: "30 min" },
  { time: "15:30", client: "Paul Martin", type: "Adjustment", duration: "10 min" },
  { time: "16:00", client: "Isabelle Moreau", type: "Frame fitting", duration: "20 min" },
];

const statusColor: Record<string, string> = {
  Ready: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "In progress": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Delivered: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  Ordered: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

const features = [
  {
    key: "clients",
    icon: "👤",
    title: "Client management",
    desc: "Store complete client profiles with contact details, date of birth, and full visit history — everything at your fingertips.",
  },
  {
    key: "prescriptions",
    icon: "🔬",
    title: "Prescription tracking",
    desc: "Record sphere, cylinder, axis, addition, and PD for each eye. Never lose a prescription again.",
  },
  {
    key: "frames",
    icon: "🕶️",
    title: "Frame & lens catalog",
    desc: "Manage your entire inventory with brand, model, color, and stock levels. Get alerts when items run low.",
  },
  {
    key: "orders",
    icon: "📦",
    title: "Order management",
    desc: "Create orders, track status from intake to delivery, and notify clients automatically when their glasses are ready.",
  },
  {
    key: "appointments",
    icon: "📅",
    title: "Appointments",
    desc: "Schedule and manage eye exams and fittings. Reduce no-shows with reminders sent directly to clients.",
  },
  {
    key: "reports",
    icon: "📊",
    title: "Dashboard & reports",
    desc: "See your shop's performance at a glance — monthly revenue, top-selling frames, and client retention.",
  },
  {
    key: "search",
    icon: "🔍",
    title: "Quick search",
    desc: "Find any client, order, or product instantly with full-text search across your entire database.",
  },
  {
    key: "print",
    icon: "🖨️",
    title: "Print & export",
    desc: "Print prescription sheets, invoices, and order summaries in one click. Export your data anytime.",
  },
  {
    key: "security",
    icon: "🔒",
    title: "Secure & private",
    desc: "Your clients' data is encrypted and stored securely. GDPR-friendly by design.",
  },
];

function ModalContent({ featureKey }: { featureKey: string }) {
  switch (featureKey) {
    case "clients":
      return (
        <div className="overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            <input placeholder="Search clients…" className="text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 focus:outline-none w-48" />
            <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg">+ New client</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                <th className="pb-2 font-medium pr-4">Name</th>
                <th className="pb-2 font-medium pr-4">Phone</th>
                <th className="pb-2 font-medium pr-4">Date of birth</th>
                <th className="pb-2 font-medium pr-4">Last visit</th>
                <th className="pb-2 font-medium">Next appt.</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.name} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer">
                  <td className="py-2.5 pr-4 font-medium text-zinc-900 dark:text-white">{c.name}</td>
                  <td className="py-2.5 pr-4 text-zinc-500">{c.phone}</td>
                  <td className="py-2.5 pr-4 text-zinc-500">{c.dob}</td>
                  <td className="py-2.5 pr-4 text-zinc-500">{c.lastVisit}</td>
                  <td className="py-2.5 text-zinc-500">{c.next}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-zinc-400">Showing 5 of 284 clients</p>
        </div>
      );

    case "prescriptions":
      return (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-sm">MD</div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-white text-sm">Marie Dubois</p>
              <p className="text-xs text-zinc-400">Prescription dated 14/07/2025 · by Dr. Lefevre</p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-400">
                  <th className="px-4 py-2.5 text-left font-medium">Eye</th>
                  <th className="px-4 py-2.5 font-medium">Sphere</th>
                  <th className="px-4 py-2.5 font-medium">Cylinder</th>
                  <th className="px-4 py-2.5 font-medium">Axis</th>
                  <th className="px-4 py-2.5 font-medium">Addition</th>
                  <th className="px-4 py-2.5 font-medium">PD</th>
                </tr>
              </thead>
              <tbody>
                {prescriptions.map((p) => (
                  <tr key={p.eye} className="border-t border-zinc-100 dark:border-zinc-700">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white text-xs">{p.eye}</td>
                    <td className="px-4 py-3 text-center text-zinc-700 dark:text-zinc-300">{p.sphere}</td>
                    <td className="px-4 py-3 text-center text-zinc-700 dark:text-zinc-300">{p.cylinder}</td>
                    <td className="px-4 py-3 text-center text-zinc-700 dark:text-zinc-300">{p.axis}</td>
                    <td className="px-4 py-3 text-center text-zinc-700 dark:text-zinc-300">{p.addition}</td>
                    <td className="px-4 py-3 text-center text-zinc-700 dark:text-zinc-300">{p.pd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex gap-2">
            <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-1 rounded-md">📋 3 previous prescriptions</span>
            <span className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-1 rounded-md">✓ Valid until Jul 2027</span>
          </div>
        </div>
      );

    case "frames":
      return (
        <div>
          <div className="flex items-center justify-between mb-4">
            <input placeholder="Search catalog…" className="text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 focus:outline-none w-48" />
            <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg">+ Add product</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {frames.map((f) => (
              <div key={f.model} className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-3 hover:border-blue-200 dark:hover:border-blue-900 transition-colors cursor-pointer">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm text-zinc-900 dark:text-white">{f.brand}</p>
                    <p className="text-xs text-zinc-500">{f.model} · {f.color}</p>
                  </div>
                  <span className="font-medium text-sm text-zinc-900 dark:text-white">{f.price}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.stock === 0 ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : f.stock <= 2 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
                    {f.stock === 0 ? "Out of stock" : `${f.stock} in stock`}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-400">Showing 6 of 132 products · 2 low-stock alerts</p>
        </div>
      );

    case "orders":
      return (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Recent orders</p>
            <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg">+ New order</button>
          </div>
          <div className="flex flex-col gap-2">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-xl border border-zinc-100 dark:border-zinc-800 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 font-mono">{o.id}</span>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{o.client}</p>
                    <p className="text-xs text-zinc-500">{o.product}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[o.status]}`}>{o.status}</span>
                  <span className="text-xs text-zinc-400">{o.date}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-400">47 orders this month · 12 awaiting pickup</p>
        </div>
      );

    case "appointments":
      return (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-sm text-zinc-900 dark:text-white">Monday, 25 August 2025</p>
              <p className="text-xs text-zinc-400">6 appointments today</p>
            </div>
            <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg">+ Book slot</button>
          </div>
          <div className="flex flex-col gap-2">
            {appointments.map((a) => (
              <div key={a.time} className="flex items-center gap-4 rounded-xl border border-zinc-100 dark:border-zinc-800 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer">
                <span className="text-sm font-mono text-blue-600 dark:text-blue-400 w-12 shrink-0">{a.time}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{a.client}</p>
                  <p className="text-xs text-zinc-500">{a.type}</p>
                </div>
                <span className="text-xs text-zinc-400">{a.duration}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case "reports":
      const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
      const values = [38, 52, 45, 61, 58, 73];
      const max = Math.max(...values);
      return (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Revenue (Aug)", value: "€18,420", trend: "+14%", up: true },
              { label: "Orders placed", value: "47", trend: "+8%", up: true },
              { label: "New clients", value: "23", trend: "-3%", up: false },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-3">
                <p className="text-xs text-zinc-400">{s.label}</p>
                <p className="text-xl font-bold text-zinc-900 dark:text-white mt-1">{s.value}</p>
                <p className={`text-xs mt-0.5 font-medium ${s.up ? "text-green-600" : "text-red-500"}`}>{s.trend} vs last month</p>
              </div>
            ))}
          </div>
          <p className="text-xs font-medium text-zinc-500 mb-2">Monthly revenue (€ thousands)</p>
          <div className="flex items-end gap-2 h-28">
            {months.map((m, i) => (
              <div key={m} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md bg-blue-500 dark:bg-blue-600 opacity-80"
                  style={{ height: `${(values[i] / max) * 100}%` }}
                />
                <span className="text-xs text-zinc-400">{m}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-zinc-100 dark:border-zinc-800 pt-3">
            <p className="text-xs font-medium text-zinc-500 mb-2">Top frames this month</p>
            {[
              { name: "Ray-Ban RB5154", sales: 9 },
              { name: "Silhouette SPX+", sales: 7 },
              { name: "Persol PO3007V", sales: 5 },
            ].map((f) => (
              <div key={f.name} className="flex items-center gap-2 mb-1.5">
                <span className="text-xs text-zinc-600 dark:text-zinc-400 w-40">{f.name}</span>
                <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(f.sales / 9) * 100}%` }} />
                </div>
                <span className="text-xs text-zinc-400">{f.sales}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case "search":
      return (
        <div>
          <input
            defaultValue="marie"
            className="w-full text-sm border border-blue-400 dark:border-blue-600 rounded-xl px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 focus:outline-none mb-4 ring-2 ring-blue-100 dark:ring-blue-900/30"
          />
          <p className="text-xs text-zinc-400 mb-3">7 results for "marie"</p>
          <div className="flex flex-col gap-1">
            {[
              { type: "Client", icon: "👤", label: "Marie Dubois", sub: "Last visit 14/07/2025" },
              { type: "Client", icon: "👤", label: "Marie-Claire Fontaine", sub: "Last visit 03/05/2025" },
              { type: "Order", icon: "📦", label: "Order #0142 — Marie Dubois", sub: "Ready for pickup" },
              { type: "Prescription", icon: "🔬", label: "Prescription — Marie Dubois", sub: "14/07/2025 · OD -2.50 / OS -2.00" },
              { type: "Appointment", icon: "📅", label: "Appt 25/08 09:00 — Marie Dubois", sub: "Eye exam · 30 min" },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors">
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
            { icon: "📋", title: "Prescription sheet", desc: "Formatted prescription for the client", action: "Print" },
            { icon: "🧾", title: "Invoice / Receipt", desc: "Full invoice for order #0142", action: "Print" },
            { icon: "📦", title: "Order summary", desc: "Current month — 47 orders", action: "Export PDF" },
            { icon: "👥", title: "Client list", desc: "All 284 clients with contact info", action: "Export Excel" },
            { icon: "📊", title: "Monthly report", desc: "August 2025 — revenue & performance", action: "Export PDF" },
            { icon: "🗃️", title: "Full data backup", desc: "All data as a .zip archive", action: "Download" },
          ].map((item) => (
            <div key={item.title} className="flex items-center justify-between rounded-xl border border-zinc-100 dark:border-zinc-800 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xl">{item.icon}</span>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{item.title}</p>
                  <p className="text-xs text-zinc-500">{item.desc}</p>
                </div>
              </div>
              <button className="text-xs border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                {item.action}
              </button>
            </div>
          ))}
        </div>
      );

    case "security":
      return (
        <div className="flex flex-col gap-4">
          {[
            { icon: "🔐", title: "End-to-end encryption", desc: "All client data is encrypted at rest and in transit using AES-256.", done: true },
            { icon: "🛡️", title: "GDPR compliant", desc: "Data stored in EU servers. Right to erasure supported.", done: true },
            { icon: "👁️", title: "Access logs", desc: "Every login and data access is logged and auditable.", done: true },
            { icon: "📱", title: "Two-factor authentication", desc: "Protect your account with 2FA via SMS or authenticator app.", done: true },
            { icon: "🔑", title: "Role-based access", desc: "Grant staff limited access — no full admin rights by default.", done: true },
            { icon: "💾", title: "Daily backups", desc: "Automatic daily snapshots retained for 30 days.", done: true },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <span className="text-xl mt-0.5">{item.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{item.title}</p>
                  <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">✓ Active</span>
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
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const activeFeatureData = features.find((f) => f.key === activeFeature);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-2xl">👓</span>
          <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">OptiApp</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#features" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">Features</a>
          <a href="#how" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">How it works</a>
          <Link href="/signin" className="text-sm text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors">Sign in</Link>
          <Link href="/signup" className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 transition-colors">Get started free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-24 pb-20 bg-gradient-to-b from-blue-50/60 to-white dark:from-blue-950/20 dark:to-zinc-950">
        <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-full px-3 py-1 mb-6">
          ✦ Built for opticians
        </span>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white max-w-3xl leading-tight">
          Everything your optical shop needs,{" "}
          <span className="text-blue-600 dark:text-blue-400">in one place.</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-500 dark:text-zinc-400 max-w-xl leading-relaxed">
          Manage clients, prescriptions, stock, and orders with ease. Stop juggling spreadsheets and paper forms — OptiApp keeps your shop organized and your clients happy.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 items-center">
          <Link href="/signup" className="px-7 py-3 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-md shadow-blue-200 dark:shadow-none">
            Start for free
          </Link>
          <a href="#features" className="px-7 py-3 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            See all features →
          </a>
        </div>
        <p className="mt-4 text-xs text-zinc-400">No credit card required · Free to get started</p>

        {/* Mock dashboard */}
        <div className="mt-16 w-full max-w-4xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <span className="w-3 h-3 rounded-full bg-red-400" />
            <span className="w-3 h-3 rounded-full bg-yellow-400" />
            <span className="w-3 h-3 rounded-full bg-green-400" />
            <span className="ml-4 text-xs text-zinc-400">optiapp.vercel.app/dashboard</span>
          </div>
          <div className="grid grid-cols-4 gap-4 p-6">
            {[
              { label: "Total clients", value: "284", icon: "👤", trend: "+12", trendLabel: "this month", up: true },
              { label: "Orders this month", value: "47", icon: "📦", trend: "+8%", trendLabel: "vs last month", up: true },
              { label: "Frames in stock", value: "132", icon: "🕶️", trend: "2 low stock", trendLabel: "alerts", up: false },
              { label: "Pending pickups", value: "12", icon: "⏳", trend: "3 overdue", trendLabel: "> 7 days", up: false },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 text-left">
                <span className="text-xl">{s.icon}</span>
                <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{s.value}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{s.label}</div>
                <div className={`mt-1.5 text-xs font-medium ${s.up ? "text-green-600 dark:text-green-400" : "text-amber-500 dark:text-amber-400"}`}>
                  {s.trend} <span className="text-zinc-400 font-normal">{s.trendLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto w-full px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">Everything you need to run your shop</h2>
          <p className="mt-3 text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto">
            Designed around the daily reality of a small optician practice. Click any feature to see a preview.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFeature(f.key)}
              className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6 flex flex-col gap-3 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all text-left group cursor-pointer"
            >
              <span className="text-3xl">{f.icon}</span>
              <h3 className="font-semibold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{f.title}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{f.desc}</p>
              <span className="text-xs text-blue-500 dark:text-blue-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">See preview →</span>
            </button>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-zinc-50 dark:bg-zinc-900 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center mb-14">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">Up and running in minutes</h2>
          <p className="mt-3 text-zinc-500 dark:text-zinc-400">No IT department needed. No complicated setup.</p>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            { step: "1", title: "Create your account", desc: "Sign up for free in under a minute. No credit card required." },
            { step: "2", title: "Add your shop's data", desc: "Import existing clients or start fresh. Add your product catalog." },
            { step: "3", title: "Start managing", desc: "Create your first order, book an appointment, track stock — you're live." },
          ].map((s) => (
            <div key={s.step} className="flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-blue-200 dark:shadow-none">
                {s.step}
              </div>
              <h3 className="font-semibold text-zinc-900 dark:text-white">{s.title}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-2xl font-medium text-zinc-700 dark:text-zinc-300 leading-relaxed italic">
            "Since we started using OptiApp, we spend half the time on admin and twice the time with our clients."
          </p>
          <div className="mt-6 flex flex-col items-center gap-1">
            <span className="font-semibold text-zinc-900 dark:text-white">Jean-Pierre M.</span>
            <span className="text-sm text-zinc-400">Optician, Lyon</span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-20 px-6 text-center">
        <h2 className="text-3xl font-bold text-white">Ready to modernize your shop?</h2>
        <p className="mt-3 text-blue-100 max-w-md mx-auto">Join opticians who manage their practice smarter with OptiApp.</p>
        <Link href="/signup" className="mt-8 inline-block px-8 py-3 rounded-full bg-white text-blue-600 font-semibold hover:bg-blue-50 transition-colors shadow-lg">
          Get started for free
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 dark:border-zinc-800 px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <span>👓</span>
          <span className="font-medium text-zinc-500 dark:text-zinc-400">OptiApp</span>
        </div>
        <div className="flex gap-5">
          <a href="#features" className="hover:text-zinc-600 transition-colors">Features</a>
          <a href="#how" className="hover:text-zinc-600 transition-colors">How it works</a>
          <Link href="/signin" className="hover:text-zinc-600 transition-colors">Sign in</Link>
          <Link href="/signup" className="hover:text-zinc-600 transition-colors">Sign up</Link>
        </div>
        <span>© 2025 OptiApp. All rights reserved.</span>
      </footer>

      {/* Feature preview modal */}
      {activeFeature && activeFeatureData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setActiveFeature(null)}
        >
          <div
            className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">{activeFeatureData.icon}</span>
                <h2 className="font-semibold text-zinc-900 dark:text-white">{activeFeatureData.title}</h2>
                <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full ml-1">Preview</span>
              </div>
              <button
                onClick={() => setActiveFeature(null)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
              <ModalContent featureKey={activeFeature} />
            </div>
            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <p className="text-xs text-zinc-400">This is a preview with sample data.</p>
              <Link href="/signup" className="text-xs bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Get started free →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
