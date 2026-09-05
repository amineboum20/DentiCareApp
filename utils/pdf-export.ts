function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

async function loadLogoDataUrl(
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

// A4 dental invoice PDF
export async function exportFacturePdf(opts: {
  factureId: string;
  docType?: "facture" | "devis";
  appointmentId?: string | null;
  patientName: string;
  patientPhone: string | null;
  patientAddress: string | null;
  createdAt: string;
  statusLabel: string;
  items: Array<{ description: string; quantity: number; unit_price: number }>;
  totalPrice: number;
  depositPaid: number;
  notes: string | null;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  logoUrl: string | null;
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
  } else {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text("DentiCare", ml, 22);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(opts.shopName || "DentiCare", mr, 17, { align: "right" });
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

  // QR code linking to appointment track page
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (origin && opts.appointmentId) {
      const QRCode = (await import("qrcode")).default;
      const qrDataUrl = await QRCode.toDataURL(`${origin}/track/${opts.appointmentId}`, {
        width: 120,
        margin: 1,
      });
      doc.addImage(qrDataUrl, "PNG", mr - 24, 254, 24, 24);
      doc.setFontSize(6);
      doc.setTextColor(160, 160, 160);
      doc.text("Suivi du RDV", mr - 12, 280, { align: "center" });
    }
  } catch { /* skip */ }

  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.line(ml, 284, mr, 284);
  doc.text(
    `Généré par DentiCare · ${invoiceNumber} · ${fmtDate(opts.createdAt)}`,
    W / 2, 289, { align: "center" }
  );

  doc.save(
    `${isDevis ? "devis" : "facture"}-dentaire-${invoiceNumber}-${opts.patientName.replace(/\s+/g, "-")}.pdf`
  );
}

// Feuille de soins (mutuelle / AMO reimbursement sheet) PDF
export async function exportFeuilleSoinsPdf(opts: {
  insurer: "CNOPS" | "CNSS";
  dossierId: string;
  dossierTitle: string;
  date: string;
  patientName: string;
  patientPhone: string | null;
  patientCin: string | null;
  patientSexe: string | null;
  patientBirthDate: string | null;
  patientAddress: string | null;
  mutuelleNumero: string | null;
  mutuelleLien: string | null;
  praticienName: string | null;
  praticienInpe: string | null;
  praticienNumeroOrdre: string | null;
  acts: Array<{ date: string | null; code: string | null; designation: string; quantity: number; honoraires: number }>;
  total: number;
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  logoUrl?: string | null;
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = 210, ml = 14, mr = W - 14;
  const isCnops = opts.insurer === "CNOPS";
  const ref = isCnops ? "1.1.03.01" : "1.2.03.01";
  const number = `FS-${opts.dossierId.slice(0, 8).toUpperCase()}`;
  const accent: [number, number, number] = isCnops ? [16, 110, 130] : [40, 90, 60];
  const col2 = ml + (mr - ml) / 2;

  const gray = (v: number) => doc.setTextColor(v, v, v);
  function band(top: number, text: string): number {
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(ml, top, mr - ml, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255);
    doc.text(text.toUpperCase(), ml + 2, top + 4.1);
    return top + 11;
  }
  function label(x: number, yy: number, text: string) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); gray(110); doc.text(text, x, yy);
  }
  function value(x: number, yy: number, text: string | null | undefined) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(25, 25, 25);
    doc.text(text && String(text).length ? String(text) : "—", x, yy);
  }
  function checkbox(x: number, yy: number, checked: boolean, text: string) {
    doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.3); doc.rect(x, yy - 3, 3.2, 3.2);
    if (checked) { doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(25, 25, 25); doc.text("X", x + 0.5, yy - 0.4); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(50, 50, 50); doc.text(text, x + 4.5, yy);
  }
  const lien = (opts.mutuelleLien || "").toLowerCase();
  const isConjoint = /conjoint|epoux|époux|epouse|épouse/.test(lien);
  const isEnfant = /enfant|fils|fille/.test(lien);
  const isLuiMeme = /lui|soi|assur|titulaire|meme|même/.test(lien);

  // ── header ──
  let logoData: { dataUrl: string; aspect: number } | null = null;
  if (opts.logoUrl) logoData = await loadLogoDataUrl(opts.logoUrl);
  if (logoData) {
    const maxW = 30, maxH = 15;
    const imgW = logoData.aspect > maxW / maxH ? maxW : maxH * logoData.aspect;
    const imgH = logoData.aspect > maxW / maxH ? maxW / logoData.aspect : maxH;
    doc.addImage(logoData.dataUrl, logoData.dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG", ml, 9, imgW, imgH);
  }
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text(opts.insurer, W / 2, 16, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(25, 25, 25);
  doc.text("Feuille de soins dentaires", W / 2, 22, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); gray(110);
  doc.text("Assurance Maladie Obligatoire", W / 2, 27, { align: "center" });
  doc.setFontSize(7.5); doc.setTextColor(90, 90, 90);
  doc.text(`Réf. ANAM ${ref}`, mr, 12, { align: "right" });
  doc.text("N° Dossier : ____________", mr, 27, { align: "right" });
  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3); doc.line(ml, 30, mr, 30);

  // ── Partie réservée à l'assuré(e) ──
  let y = band(34, "Partie réservée à l'assuré(e)");
  label(ml, y, "Nom et prénom"); value(ml + 28, y, opts.patientName); y += 7;
  if (isCnops) { label(ml, y, "N° Affiliation"); value(ml + 28, y, opts.mutuelleNumero); label(col2, y, "N° Immatriculation"); value(col2 + 32, y, opts.mutuelleNumero); }
  else { label(ml, y, "N° Immatriculation"); value(ml + 32, y, opts.mutuelleNumero); }
  y += 7;
  label(ml, y, "N° CIN"); value(ml + 28, y, opts.patientCin);
  label(col2, y, "Lien de parenté"); checkbox(col2 + 28, y, isConjoint, "Conjoint"); checkbox(col2 + 50, y, isEnfant, "Enfant");
  if (!isCnops) checkbox(col2 + 68, y, isLuiMeme, "Lui-même");
  y += 7;
  label(ml, y, "Adresse"); value(ml + 28, y, opts.patientAddress); y += 7;
  label(ml, y, "Montant des frais (Dhs)"); value(ml + 40, y, opts.total.toFixed(2));
  label(col2, y, "Nombre de pièces jointes"); value(col2 + 42, y, "____");

  // ── Bénéficiaire de soins ──
  y = band(y + 3, "Bénéficiaire de soins");
  label(ml, y, "Nom et prénom"); value(ml + 28, y, opts.patientName); y += 7;
  label(ml, y, "Date de naissance"); value(ml + 30, y, opts.patientBirthDate ? fmtDate(opts.patientBirthDate) : null);
  label(col2, y, "Sexe"); checkbox(col2 + 12, y, opts.patientSexe === "M", "M"); checkbox(col2 + 28, y, opts.patientSexe === "F", "F");
  label(col2 + 46, y, "N° CIN"); value(col2 + 58, y, opts.patientCin);

  // ── Identification du chirurgien dentiste ──
  y = band(y + 3, "Identification du chirurgien dentiste");
  label(ml, y, "N° INP"); value(ml + 28, y, opts.praticienInpe); y += 7;
  label(ml, y, "Type de soins");
  checkbox(ml + 28, y, false, "Soins"); checkbox(ml + 48, y, false, "Prothèse"); checkbox(ml + 74, y, false, "Orthodontie / ODF"); checkbox(ml + 116, y, false, "Autres");
  y += 7;
  label(ml, y, "N° entente préalable"); value(ml + 36, y, "____");

  // ── Description des actes ──
  y = band(y + 3, "Description des actes");
  const cDent = ml + 1, cCode = ml + 16, cDate = ml + 34, cDes = ml + 58, cMont = mr - 1;
  doc.setFillColor(238, 240, 242); doc.rect(ml, y - 4.5, mr - ml, 6, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); gray(70);
  doc.text("Dents", cDent, y); doc.text("Code", cCode, y); doc.text("Date", cDate, y); doc.text("Désignation de l'acte", cDes, y); doc.text("Montant (MAD)", cMont, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  for (const a of opts.acts) {
    gray(45);
    doc.text(a.code ?? "—", cCode, y);
    doc.text(a.date ? fmtDate(a.date) : "—", cDate, y);
    const desig = a.quantity > 1 ? `${a.designation} (x${a.quantity})` : a.designation;
    doc.setTextColor(30, 30, 30); doc.text(doc.splitTextToSize(desig, cMont - cDes - 22)[0], cDes, y);
    doc.text(a.honoraires.toFixed(2), cMont, y, { align: "right" });
    y += 7;
    doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.2); doc.line(ml, y - 2.5, mr, y - 2.5);
  }
  y += 3;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); gray(90);
  doc.text("Total honoraires :", cMont - 30, y, { align: "right" });
  doc.setTextColor(20, 20, 20); doc.text(`${opts.total.toFixed(2)} MAD`, cMont, y, { align: "right" });

  // ── Attestation / signature ──
  const boxY = Math.max(y + 14, 252);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); gray(110);
  doc.text("Fait à ______________  le __________", ml, boxY);
  doc.text("Signature de l'assuré(e)", ml, boxY + 20);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
  doc.text(opts.praticienName ? `Dr. ${opts.praticienName}` : "Le chirurgien dentiste", mr, boxY, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); gray(120);
  if (opts.praticienInpe) doc.text(`INPE : ${opts.praticienInpe}`, mr, boxY + 5, { align: "right" });
  doc.text("Cachet et signature du praticien", mr, boxY + 20, { align: "right" });

  doc.setFontSize(6.5); doc.setTextColor(160, 160, 160);
  doc.text(`Généré par DentiCare · ${opts.insurer} · ${number} · ${fmtDate(opts.date)}`, W / 2, 291, { align: "center" });

  doc.save(`feuille-soins-${opts.insurer}-${number}-${opts.patientName.replace(/\s+/g, "-")}.pdf`);
}

// Prescription (ordonnance) PDF
export async function exportOrdonnancePdf(opts: {
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
  } else {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text("DentiCare", ml, 22);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(opts.shopName || "DentiCare", mr, 17, { align: "right" });
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

  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.line(ml, 284, mr, 284);
  doc.text(`Généré par DentiCare · ${number} · ${fmtDate(opts.date)}`, W / 2, 289, { align: "center" });

  doc.save(`ordonnance-${number}-${opts.patientName.replace(/\s+/g, "-")}.pdf`);
}

// Care plan / treatment plan PDF
export async function exportCarePlanPdf(opts: {
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
  } else {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text("DentiCare", ml, 22);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(opts.shopName || "DentiCare", mr, 17, { align: "right" });
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

  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.line(ml, 284, mr, 284);
  doc.text(
    `Généré par DentiCare · ${fmtDate(opts.createdAt)}`,
    W / 2, 289, { align: "center" }
  );

  doc.save(
    `plan-traitement-${opts.patientName.replace(/\s+/g, "-")}-${opts.createdAt.slice(0, 10)}.pdf`
  );
}
