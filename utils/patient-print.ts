// Printable patient sheet: patient info + the odontogram, as a one-page PDF.

import { STATUS_COLORS, STATUS_KEYS, buildOdontogramSvg } from "@/components/odontogram-data";
import { patientPortalUrl } from "@/utils/site";

const STATUS_FR: Record<string, string> = {
  carie: "Carie", obturee: "Obturée", couronne: "Couronne", a_traiter: "À traiter",
  prothese: "Prothèse", bridge: "Bridge", implant: "Implant", absente: "Absente",
};

export interface PatientPrintOpts {
  patientName: string;
  dob: string | null;
  sexe: string | null;
  cin: string | null;
  phone: string | null;
  address: string | null;
  mutuelleOrganisme: string | null;
  mutuelleNumero: string | null;
  mutuelleLien: string | null;
  chart: Record<string, { status: string }>;
  isChild: boolean;
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  patientToken?: string | null;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR");
}

function svgToPng(svg: string, w: number, h: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("no canvas ctx")); return; }
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export async function exportPatientInfoPdf(o: PatientPrintOpts): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = 210, ml = 18, mr = W - 18;

  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(20, 20, 20);
  doc.text(o.shopName || "DentiCare", ml, 18);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(110, 110, 110);
  let hy = 23;
  if (o.shopAddress) { doc.text(o.shopAddress, ml, hy); hy += 4; }
  if (o.shopPhone) { doc.text(o.shopPhone, ml, hy); hy += 4; }
  doc.setDrawColor(200, 200, 200); doc.line(ml, 30, mr, 30);

  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(20, 20, 20);
  doc.text("Fiche patient", ml, 42);
  doc.setFontSize(13); doc.text(o.patientName, ml, 50);

  const info: [string, string | null][] = [
    ["Date de naissance", o.dob ? fmtDate(o.dob) : null],
    ["Sexe", o.sexe === "M" ? "Homme" : o.sexe === "F" ? "Femme" : null],
    ["N° CIN", o.cin],
    ["Téléphone", o.phone],
    ["Adresse", o.address],
    ["Mutuelle", o.mutuelleOrganisme],
    ["N° immatriculation", o.mutuelleNumero],
    ["Lien de parenté", o.mutuelleLien],
  ];
  doc.setFontSize(9.5);
  let y = 60;
  for (const [label, val] of info) {
    if (!val) continue;
    doc.setFont("helvetica", "normal"); doc.setTextColor(120, 120, 120);
    doc.text(`${label} :`, ml, y);
    doc.setTextColor(30, 30, 30);
    doc.text(String(val), ml + 45, y);
    y += 6.5;
  }
  y += 3;
  doc.setDrawColor(220, 220, 220); doc.line(ml, y, mr, y); y += 8;

  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
  doc.text("Schéma dentaire", ml, y); y += 3;

  const png = await svgToPng(buildOdontogramSvg(o.chart, o.isChild), 409 * 3, 694 * 3);
  const imgW = 78, imgH = (imgW * 694) / 409;
  doc.addImage(png, "PNG", (W - imgW) / 2, y, imgW, imgH);
  y += imgH + 7;

  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  let lx = ml, ly = y;
  for (const key of STATUS_KEYS) {
    const hex = STATUS_COLORS[key].replace("#", "");
    doc.setFillColor(parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16));
    doc.rect(lx, ly - 3, 3, 3, "F");
    doc.setTextColor(90, 90, 90);
    doc.text(STATUS_FR[key], lx + 4.5, ly);
    lx += 46;
    if (lx > mr - 30) { lx = ml; ly += 6; }
  }

  if (o.patientToken) {
    try {
      const QRCode = (await import("qrcode")).default;
      const qr = await QRCode.toDataURL(patientPortalUrl(o.patientToken), { width: 160, margin: 1 });
      const size = 20, qx = W - 18 - size, qy = 262;
      doc.addImage(qr, "PNG", qx, qy, size, size);
      doc.setFontSize(6); doc.setTextColor(150, 150, 150);
      doc.text("Mon espace patient", qx + size / 2, qy + size + 3, { align: "center" });
    } catch { /* best-effort */ }
  }

  doc.setFontSize(7); doc.setTextColor(160, 160, 160);
  doc.text(`Généré par DentiCare · ${fmtDate(new Date().toISOString())}`, W / 2, 291, { align: "center" });
  doc.save(`fiche-${o.patientName.replace(/\s+/g, "-")}.pdf`);
}
