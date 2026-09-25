// PDF of a subscription invoice issued by MediCareApp to a shop / cabinet.
// French only (legal document). Company details come from utils/company.ts
// (placeholders until the company is registered).

import { COMPANY, PLAN_LABEL } from "@/utils/company";
import { appLogoPng, drawBrandedFooter, finishPdf, type PdfOutput } from "@/utils/pdf-export";
import type { SubscriptionInvoiceRow } from "@/utils/subscription";

const APP_NAME = "DentiCareApp";
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// jsPDF's standard fonts have no U+2212 / narrow no-break space: plain ASCII.
const money = (v: number, cur: string) => `${v < 0 ? "-" : ""}${Math.abs(Number(v)).toFixed(2).replace(".", ",")} ${cur}`;
const day = (d: string) => { const [y, m, dd] = d.slice(0, 10).split("-"); return `${dd}/${m}/${y}`; };
const month = (d: string) => { const [y, m] = d.slice(0, 10).split("-"); return `${MONTHS[Number(m) - 1]} ${y}`; };

export async function exportSubscriptionInvoicePdf(opts: {
  invoice: SubscriptionInvoiceRow;
  practiceName: string;
  practiceAddress?: string | null;
  practicePhone?: string | null;
  output?: PdfOutput;
}) {
  const { invoice: inv } = opts;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = 210, ml = 20, mr = W - 20;
  const cur = inv.currency || "MAD";

  // ── Issuer (left) ────────────────────────────────
  const logo = await appLogoPng();
  let y = 16;
  if (logo) { doc.addImage(logo.dataUrl, "PNG", ml, y - 5, 7 * logo.aspect, 7, undefined, "FAST"); }
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(20, 20, 20);
  doc.text(COMPANY.name, ml + (logo ? 7 * logo.aspect + 3 : 0), y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
  y += 6;
  for (const line of [COMPANY.address, COMPANY.city, `${COMPANY.phone} · ${COMPANY.email}`, `ICE ${COMPANY.ice} · IF ${COMPANY.if} · RC ${COMPANY.rc}`]) {
    doc.text(line, ml, y); y += 4.5;
  }

  // ── Title (right) ────────────────────────────────
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(20, 20, 20);
  doc.text("FACTURE", mr, 18, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
  doc.text(`N° ${inv.number}`, mr, 25, { align: "right" });
  doc.text(`Date : ${day(inv.issued_at)}`, mr, 30, { align: "right" });
  doc.text(`Période : du ${day(inv.period_start)} au ${day(inv.period_end)}`, mr, 35, { align: "right" });

  doc.setDrawColor(210, 210, 210);
  doc.line(ml, 44, mr, 44);

  // ── Bill to ──────────────────────────────────────
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(130, 130, 130);
  doc.text("FACTURÉ À", ml, 52);
  doc.setFontSize(11); doc.setTextColor(20, 20, 20);
  doc.text(opts.practiceName || "—", ml, 58);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  let by = 63;
  if (opts.practiceAddress) { doc.text(opts.practiceAddress, ml, by); by += 4.5; }
  if (opts.practicePhone) { doc.text(opts.practicePhone, ml, by); by += 4.5; }

  // ── Line table ───────────────────────────────────
  let ty = Math.max(by + 8, 80);
  doc.setFillColor(244, 244, 245);
  doc.rect(ml, ty - 5, mr - ml, 8, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(80, 80, 80);
  doc.text("DÉSIGNATION", ml + 3, ty);
  doc.text("PÉRIODE", 120, ty);
  doc.text("MONTANT", mr - 3, ty, { align: "right" });
  ty += 10;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(20, 20, 20);
  doc.text(`Abonnement ${APP_NAME} — formule ${PLAN_LABEL[inv.plan] ?? inv.plan}`, ml + 3, ty);
  doc.text(month(inv.period_start), 120, ty);
  doc.text(money(inv.amount, cur), mr - 3, ty, { align: "right" });
  ty += 5;
  doc.setDrawColor(230, 230, 230);
  doc.line(ml, ty, mr, ty);

  // ── Summary (right) ──────────────────────────────
  let sy = ty + 10;
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 9.5);
    doc.setTextColor(bold ? 20 : 70, bold ? 20 : 70, bold ? 20 : 70);
    doc.text(label, 120, sy);
    doc.text(value, mr - 3, sy, { align: "right" });
    sy += bold ? 8 : 6;
  };
  const prev = Number(inv.previous_balance), total = Number(inv.total_due);
  row(prev < 0 ? "Solde précédent (crédit)" : "Solde précédent", money(prev, cur));
  row(`Mensualité ${month(inv.period_start)}`, money(inv.amount, cur));
  doc.setDrawColor(200, 200, 200); doc.line(120, sy - 3, mr, sy - 3); sy += 2;
  if (total < 0) row("Crédit en votre faveur", money(-total, cur), true);
  else row("Total à payer", money(total, cur), true);

  // ── Payment details ──────────────────────────────
  let py = Math.max(sy + 12, 150);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(40, 40, 40);
  doc.text("Règlement", ml, py);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
  py += 5;
  doc.text(`Par virement : ${COMPANY.bank} — RIB ${COMPANY.rib}`, ml, py); py += 4.5;
  doc.text(`Merci d'indiquer le numéro de facture ${inv.number} dans le libellé du virement.`, ml, py); py += 4.5;
  if (prev > 0) { doc.text("Le solde précédent correspond à des factures non encore réglées.", ml, py); py += 4.5; }
  if (COMPANY.placeholder) {
    doc.setTextColor(200, 60, 60);
    doc.text("Données de l'émetteur provisoires.", ml, py + 3);
  }

  // ── Footer ───────────────────────────────────────
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(150, 150, 150);
  doc.text(`${COMPANY.name} · ICE ${COMPANY.ice} · IF ${COMPANY.if} · RC ${COMPANY.rc} · Patente ${COMPANY.patente}`, W / 2, 283, { align: "center" });
  doc.setFontSize(8);
  drawBrandedFooter(doc, logo, `Généré par ${APP_NAME} · ${inv.number} · ${day(inv.issued_at)}`, W / 2, 289, "center", 3.2);

  return finishPdf(doc, `facture-abonnement-${inv.number}.pdf`, opts.output);
}
