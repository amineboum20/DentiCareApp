import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Social share card (Facebook, WhatsApp, LinkedIn…). Satori's default font has
// no Arabic glyphs, so the Arabic card reuses the French wording. The wordmark
// parts are separate spans; the -6px margins cancel Satori's per-item gap.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "DentiCareApp — logiciel de gestion pour cabinets dentaires";

const TAGLINE: Record<string, [string, string]> = {
  fr: ["Le logiciel de gestion pour cabinets dentaires", "Patients · Schéma dentaire · Rendez-vous · Factures · CNOPS/CNSS"],
  en: ["Practice management software for dentists", "Patients · Dental chart · Appointments · Invoices"],
};

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [tagline, sub] = TAGLINE[locale] ?? TAGLINE.fr;
  const logo = await readFile(join(process.cwd(), "public", "logo.svg"), "base64");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #ffffff 0%, #f4f4f5 100%)",
          borderBottom: "16px solid #0d9488",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/svg+xml;base64,${logo}`} width={230} height={240} alt="" />
        <div style={{ display: "flex", fontSize: 84, fontWeight: 700, marginTop: 36, color: "#18181b" }}>
          <span>Denti</span><span style={{ color: "#0d9488", marginLeft: -6 }}>Care</span><span style={{ marginLeft: -6 }}>App</span>
        </div>
        <div style={{ display: "flex", fontSize: 40, marginTop: 16, color: "#3f3f46" }}>{tagline}</div>
        <div style={{ display: "flex", fontSize: 28, marginTop: 20, color: "#0f766e" }}>{sub}</div>
      </div>
    ),
    size,
  );
}
