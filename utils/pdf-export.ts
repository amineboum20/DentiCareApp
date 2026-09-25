import type { jsPDF } from "jspdf";
import { patientPortalUrl } from "@/utils/site";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

// Patient-portal QR, bottom-right. Scans to the DOB-gated patient page.
async function drawPortalQr(doc: jsPDF, token: string | null | undefined, W: number) {
  if (!token) return;
  try {
    const QRCode = (await import("qrcode")).default;
    const dataUrl = await QRCode.toDataURL(patientPortalUrl(token), { width: 160, margin: 1 });
    const size = 20, x = W - 20 - size, y = 258;
    doc.addImage(dataUrl, "PNG", x, y, size, size);
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text("Mon espace patient", x + size / 2, y + size + 3, { align: "center" });
  } catch {
    /* QR is best-effort */
  }
}

// Every exporter downloads the PDF by default; with output: "blob" it returns
// it instead (the Documents page bundles several into a ZIP).
export type PdfOutput = "save" | "blob";
export type PdfFile = { filename: string; blob: Blob };
export function finishPdf(doc: InstanceType<typeof import("jspdf").jsPDF>, filename: string, output?: PdfOutput): PdfFile | undefined {
  if (output === "blob") return { filename, blob: doc.output("blob") };
  doc.save(filename);
  return undefined;
}

export async function loadLogoDataUrl(
  url: string
): Promise<{ dataUrl: string; aspect: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const aspect = await new Promise<number>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth / (img.naturalHeight || 1));
      img.onerror = () => resolve(2);
      img.src = dataUrl;
    });
    return { dataUrl, aspect };
  } catch {
    return null;
  }
}

// Brand mark shown in the footer of every generated document: the real app
// logo (public/logo.svg) + the "DentiCareApp" wordmark with "Care" in the brand colour,
// as on the site. jsPDF can't embed SVG, so the logo is rasterised to a PNG
// via canvas once and cached.
export const APP_NAME_PARTS = ["Denti", "Care", "App"] as const;
const APP_NAME = APP_NAME_PARTS.join("");
const WORDMARK_RGB: [number, number, number] = [39, 39, 42]; // zinc-800, like the site wordmark
const BRAND_RGB: [number, number, number] = [13, 148, 136]; // #0d9488 — logo colour

let appLogoPromise: Promise<{ dataUrl: string; aspect: number } | null> | null = null;
export function appLogoPng(): Promise<{ dataUrl: string; aspect: number } | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  if (appLogoPromise) return appLogoPromise;
  const p = (async () => {
    try {
      // logo.svg only has a viewBox: give it an explicit size (Firefox won't
      // rasterise an SVG without one) and draw it from a data URL.
      const svg = await (await fetch("/logo.svg")).text();
      const vb = svg.match(/viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/);
      const aspect = vb ? Number(vb[1]) / Number(vb[2]) : 1;
      const h = 128, w = Math.round(h * aspect);
      const sized = svg.replace(/<svg\b/, `<svg width="${w}" height="${h}"`);
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(sized); });
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, w, h);
      return { dataUrl: canvas.toDataURL("image/png"), aspect };
    } catch {
      return null;
    }
  })().then((r) => { if (!r) appLogoPromise = null; return r; });
  appLogoPromise = p;
  return p;
}

// Draw "[logo] <text>" as one centered or right-aligned group; the app name
// inside <text> is drawn bold with "Care" in the brand colour. Assumes the
// caller has already set the footer font size and colour.
export function drawBrandedFooter(
  doc: InstanceType<typeof import("jspdf").jsPDF>,
  logo: { dataUrl: string; aspect: number } | null,
  text: string,
  anchorX: number,
  y: number,
  align: "center" | "right",
  markSize = 3.2
) {
  const gap = 1.2;
  const baseColor = doc.getTextColor();
  const { fontName, fontStyle } = doc.getFont();
  const at = text.indexOf(APP_NAME);
  // Segments: [text, bold, rgb?]
  const segs: [string, boolean, [number, number, number] | null][] = at < 0
    ? [[text, false, null]]
    : [
        [text.slice(0, at), false, null],
        [APP_NAME_PARTS[0], true, WORDMARK_RGB],
        [APP_NAME_PARTS[1], true, BRAND_RGB],
        [APP_NAME_PARTS[2], true, WORDMARK_RGB],
        [text.slice(at + APP_NAME.length), false, null],
      ];
  const width = (s: string, bold: boolean) => {
    doc.setFont(fontName, bold ? "bold" : fontStyle);
    return doc.getTextWidth(s);
  };
  const logoW = logo ? markSize * logo.aspect : 0;
  const textW = segs.reduce((w, [s, b]) => w + (s ? width(s, b) : 0), 0);
  const totalW = (logo ? logoW + gap : 0) + textW;
  let x = align === "center" ? anchorX - totalW / 2 : anchorX - totalW;
  if (logo) {
    doc.addImage(logo.dataUrl, "PNG", x, y - markSize + 0.7, logoW, markSize, undefined, "FAST");
    x += logoW + gap;
  }
  for (const [s, bold, rgb] of segs) {
    if (!s) continue;
    doc.setFont(fontName, bold ? "bold" : fontStyle);
    if (rgb) doc.setTextColor(...rgb); else doc.setTextColor(baseColor);
    doc.text(s, x, y);
    x += doc.getTextWidth(s);
  }
  doc.setFont(fontName, fontStyle);
  doc.setTextColor(baseColor);
}

// A4 dental invoice PDF
export async function exportFacturePdf(opts: {
  output?: PdfOutput;
  factureId: string;
  docType?: "facture" | "devis";
  appointmentId?: string | null;
  patientName: string;
  patientPhone: string | null;
  patientAddress: string | null;
  createdAt: string;
  statusLabel: string;
  items: Array<{ description: string; quantity: number; unit_price: number; teeth?: string[] | null }>;
  totalPrice: number;
  depositPaid: number;
  notes: string | null;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  logoUrl: string | null;
  patientToken?: string | null;
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = 210, ml = 20, mr = W - 20;
  const isDevis = opts.docType === "devis";
  const invoiceNumber = `${isDevis ? "DV" : "DC"}-${opts.factureId.slice(0, 8).toUpperCase()}`;

  let logoData: { dataUrl: string; aspect: number } | null = null;
  if (opts.logoUrl) logoData = await loadLogoDataUrl(opts.logoUrl);

  if (logoData) {
    const maxW = 40, maxH = 20;
    const imgW = logoData.aspect > maxW / maxH ? maxW : maxH * logoData.aspect;
    const imgH = logoData.aspect > maxW / maxH ? maxW / logoData.aspect : maxH;
    doc.addImage(
      logoData.dataUrl,
      logoData.dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG",
      ml, 12, imgW, imgH
    );
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  if (opts.shopName) doc.text(opts.shopName, mr, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  if (opts.shopAddress) doc.text(opts.shopAddress, mr, 23, { align: "right" });
  if (opts.shopPhone) doc.text(opts.shopPhone, mr, 28, { align: "right" });

  doc.setDrawColor(200, 200, 200);
  doc.line(ml, 36, mr, 36);

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text(isDevis ? "DEVIS DENTAIRE" : "FACTURE DENTAIRE", ml, 50);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`N° ${invoiceNumber}`, ml, 57);

  doc.setFontSize(9);
  doc.text("Date :", mr - 38, 50);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text(fmtDate(opts.createdAt), mr, 50, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("Statut :", mr - 38, 57);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text(opts.statusLabel, mr, 57, { align: "right" });

  doc.setDrawColor(200, 200, 200);
  doc.line(ml, 64, mr, 64);

  let y = 73;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text("FACTURER À", ml, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(opts.patientName, ml, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  if (opts.patientPhone) { doc.text(opts.patientPhone, ml, y); y += 5; }
  if (opts.patientAddress) {
    const addrLines = doc.splitTextToSize(opts.patientAddress, 90);
    doc.text(addrLines, ml, y);
    y += addrLines.length * 5;
  }
  y += 6;
  doc.setDrawColor(220, 220, 220);
  doc.line(ml, y, mr, y);

  y += 9;
  const colDesc = ml, colQty = mr - 58, colUnit = mr - 30, colTot = mr;
  doc.setFillColor(244, 244, 248);
  doc.rect(ml, y - 4.5, mr - ml, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text("Description", colDesc, y);
  doc.text("Qté", colQty, y, { align: "center" });
  doc.text("Prix unit.", colUnit, y, { align: "right" });
  doc.text("Total (MAD)", colTot, y, { align: "right" });

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const item of opts.items) {
    const lineTotal = item.quantity * item.unit_price;
    doc.setTextColor(30, 30, 30);
    doc.text(doc.splitTextToSize(item.description, colQty - colDesc - 6)[0], colDesc, y);
    doc.setTextColor(50, 50, 50);
    doc.text(String(item.quantity), colQty, y, { align: "center" });
    doc.text(item.unit_price.toFixed(2), colUnit, y, { align: "right" });
    doc.text(lineTotal.toFixed(2), colTot, y, { align: "right" });
    y += 7;
    if (item.teeth && item.teeth.length > 0) {
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.text(`Dents : ${item.teeth.join(", ")}`, colDesc + 2, y - 2.5);
      doc.setFontSize(9);
      y += 4;
    }
    doc.setDrawColor(235, 235, 235);
    doc.line(ml, y - 2, mr, y - 2);
  }

  y += 4;
  const remaining = opts.totalPrice - opts.depositPaid;
  const addRow = (
    label: string,
    amount: number,
    bold = false,
    rgb?: [number, number, number]
  ) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 10 : 9);
    doc.setTextColor(100, 100, 100);
    doc.text(label, colUnit, y, { align: "right" });
    doc.setTextColor(...(rgb ?? ([30, 30, 30] as [number, number, number])));
    doc.text(`${amount.toFixed(2)} MAD`, colTot, y, { align: "right" });
    y += 7;
  };
  addRow("Total :", opts.totalPrice, true);
  addRow("Acompte versé :", opts.depositPaid);
  if (remaining > 0) {
    doc.setDrawColor(220, 180, 50);
    doc.line(ml + 90, y - 2, mr, y - 2);
    addRow("Reste à payer :", remaining, true, [160, 70, 0]);
  } else {
    addRow("Solde :", 0, true, [0, 130, 80]);
  }

  if (opts.notes) {
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("Notes :", ml, y);
    doc.setTextColor(40, 40, 40);
    const noteLines = doc.splitTextToSize(opts.notes, mr - ml - 28);
    doc.text(noteLines, ml + 28, y);
  }

  // QR code linking to appointment track page (bottom-left, to leave the
  // bottom-right corner for the patient-portal QR).
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (origin && opts.appointmentId) {
      const QRCode = (await import("qrcode")).default;
      const qrDataUrl = await QRCode.toDataURL(`${origin}/track/${opts.appointmentId}`, {
        width: 120,
        margin: 1,
      });
      doc.addImage(qrDataUrl, "PNG", ml, 258, 20, 20);
      doc.setFontSize(6);
      doc.setTextColor(160, 160, 160);
      doc.text("Suivi du RDV", ml + 10, 281, { align: "center" });
    }
  } catch { /* skip */ }

  await drawPortalQr(doc, opts.patientToken, W);

  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.line(ml, 284, mr, 284);
  drawBrandedFooter(
    doc, await appLogoPng(),
    `Généré par DentiCareApp · ${invoiceNumber} · ${fmtDate(opts.createdAt)}`,
    W / 2, 289, "center", 3.2
  );

  return finishPdf(doc, `${isDevis ? "devis" : "facture"}-dentaire-${invoiceNumber}-${opts.patientName.replace(/\s+/g, "-")}.pdf`, opts.output);
}

// Prescription (ordonnance) PDF
export async function exportOrdonnancePdf(opts: {
  output?: PdfOutput;
  ordonnanceId: string;
  patientName: string;
  patientPhone: string | null;
  date: string;
  prescriber: string | null;
  lines: Array<{ name: string; posologie: string | null; duree: string | null; quantite: string | null; instructions: string | null }>;
  notes: string | null;
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  logoUrl?: string | null;
  patientToken?: string | null;
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = 210, ml = 20, mr = W - 20;
  const number = `ORD-${opts.ordonnanceId.slice(0, 8).toUpperCase()}`;

  let logoData: { dataUrl: string; aspect: number } | null = null;
  if (opts.logoUrl) logoData = await loadLogoDataUrl(opts.logoUrl);

  if (logoData) {
    const maxW = 40, maxH = 20;
    const imgW = logoData.aspect > maxW / maxH ? maxW : maxH * logoData.aspect;
    const imgH = logoData.aspect > maxW / maxH ? maxW / logoData.aspect : maxH;
    doc.addImage(logoData.dataUrl, logoData.dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG", ml, 12, imgW, imgH);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  if (opts.shopName) doc.text(opts.shopName, mr, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  if (opts.shopAddress) doc.text(opts.shopAddress, mr, 23, { align: "right" });
  if (opts.shopPhone) doc.text(opts.shopPhone, mr, 28, { align: "right" });

  doc.setDrawColor(200, 200, 200);
  doc.line(ml, 36, mr, 36);

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("ORDONNANCE", ml, 50);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`N° ${number}`, ml, 57);
  doc.text("Date :", mr - 38, 50);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text(fmtDate(opts.date), mr, 50, { align: "right" });

  doc.setDrawColor(200, 200, 200);
  doc.line(ml, 64, mr, 64);

  let y = 73;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text("PATIENT", ml, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(opts.patientName, ml, y);
  y += 6;
  if (opts.patientPhone) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(70, 70, 70);
    doc.text(opts.patientPhone, ml, y);
    y += 5;
  }
  y += 6;
  doc.setDrawColor(220, 220, 220);
  doc.line(ml, y, mr, y);

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text("PRESCRIPTION", ml, y);
  y += 8;

  opts.lines.forEach((l, i) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(`${i + 1}. ${l.name}`, ml, y);
    y += 5.5;
    const meta = [
      l.posologie ? `Posologie : ${l.posologie}` : null,
      l.duree ? `Durée : ${l.duree}` : null,
      l.quantite ? `Quantité : ${l.quantite}` : null,
    ].filter(Boolean).join("   ·   ");
    if (meta) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(70, 70, 70);
      doc.text(doc.splitTextToSize(meta, mr - ml), ml + 4, y);
      y += 5.5;
    }
    if (l.instructions) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      const insLines = doc.splitTextToSize(l.instructions, mr - ml - 4) as string[];
      doc.text(insLines, ml + 4, y);
      y += insLines.length * 5;
    }
    y += 4;
  });

  if (opts.notes) {
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("Notes :", ml, y);
    doc.setTextColor(40, 40, 40);
    const noteLines = doc.splitTextToSize(opts.notes, mr - ml - 28);
    doc.text(noteLines, ml + 28, y);
  }

  // Prescriber signature block (bottom-right).
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(opts.prescriber ? `Dr. ${opts.prescriber}` : "Le praticien", mr, 250, { align: "right" });
  doc.setDrawColor(200, 200, 200);
  doc.line(mr - 55, 262, mr, 262);
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text("Signature / cachet", mr, 266, { align: "right" });

  await drawPortalQr(doc, opts.patientToken, W);

  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.line(ml, 284, mr, 284);
  drawBrandedFooter(doc, await appLogoPng(), `Généré par DentiCareApp · ${number} · ${fmtDate(opts.date)}`, W / 2, 289, "center", 3.2);

  return finishPdf(doc, `ordonnance-${number}-${opts.patientName.replace(/\s+/g, "-")}.pdf`, opts.output);
}

// Care plan / treatment plan PDF
export async function exportCarePlanPdf(opts: {
  output?: PdfOutput;
  patientName: string;
  patientPhone: string | null;
  createdAt: string;
  treatments: Array<{ description: string; estimated_sessions: number | null; estimated_cost: number | null }>;
  totalEstimated: number;
  notes: string | null;
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  logoUrl?: string | null;
  patientToken?: string | null;
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = 210, ml = 20, mr = W - 20;

  let logoData: { dataUrl: string; aspect: number } | null = null;
  if (opts.logoUrl) logoData = await loadLogoDataUrl(opts.logoUrl);

  if (logoData) {
    const maxW = 40, maxH = 20;
    const imgW = logoData.aspect > maxW / maxH ? maxW : maxH * logoData.aspect;
    const imgH = logoData.aspect > maxW / maxH ? maxW / logoData.aspect : maxH;
    doc.addImage(
      logoData.dataUrl,
      logoData.dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG",
      ml, 12, imgW, imgH
    );
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  if (opts.shopName) doc.text(opts.shopName, mr, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  if (opts.shopAddress) doc.text(opts.shopAddress, mr, 23, { align: "right" });
  if (opts.shopPhone) doc.text(opts.shopPhone, mr, 28, { align: "right" });

  doc.setDrawColor(200, 200, 200);
  doc.line(ml, 36, mr, 36);

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("PLAN DE TRAITEMENT", ml, 50);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Établi le ${fmtDate(opts.createdAt)}`, ml, 57);

  doc.setDrawColor(200, 200, 200);
  doc.line(ml, 64, mr, 64);

  let y = 73;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text("PATIENT", ml, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(opts.patientName, ml, y);
  y += 6;
  if (opts.patientPhone) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(70, 70, 70);
    doc.text(opts.patientPhone, ml, y);
    y += 5;
  }
  y += 6;
  doc.setDrawColor(220, 220, 220);
  doc.line(ml, y, mr, y);

  y += 9;
  const colTreat = ml, colSess = mr - 50, colCost = mr;
  doc.setFillColor(244, 244, 248);
  doc.rect(ml, y - 4.5, mr - ml, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text("Traitement", colTreat, y);
  doc.text("Séances", colSess, y, { align: "center" });
  doc.text("Coût estimé (MAD)", colCost, y, { align: "right" });

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const item of opts.treatments) {
    doc.setTextColor(30, 30, 30);
    doc.text(doc.splitTextToSize(item.description, colSess - colTreat - 6)[0], colTreat, y);
    doc.setTextColor(50, 50, 50);
    doc.text(
      item.estimated_sessions != null ? String(item.estimated_sessions) : "—",
      colSess, y, { align: "center" }
    );
    doc.text(
      item.estimated_cost != null ? item.estimated_cost.toFixed(2) : "—",
      colCost, y, { align: "right" }
    );
    y += 7;
    doc.setDrawColor(235, 235, 235);
    doc.line(ml, y - 2, mr, y - 2);
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Total estimé :", colSess, y, { align: "right" });
  doc.setTextColor(20, 20, 20);
  doc.text(`${opts.totalEstimated.toFixed(2)} MAD`, colCost, y, { align: "right" });

  if (opts.notes) {
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("Notes :", ml, y);
    doc.setTextColor(40, 40, 40);
    const noteLines = doc.splitTextToSize(opts.notes, mr - ml - 28);
    doc.text(noteLines, ml + 28, y);
  }

  await drawPortalQr(doc, opts.patientToken, W);

  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.line(ml, 284, mr, 284);
  drawBrandedFooter(
    doc, await appLogoPng(),
    `Généré par DentiCareApp · ${fmtDate(opts.createdAt)}`,
    W / 2, 289, "center", 3.2
  );

  return finishPdf(doc, `plan-traitement-${opts.patientName.replace(/\s+/g, "-")}-${opts.createdAt.slice(0, 10)}.pdf`, opts.output);
}
