// Feuille de soins (CNOPS / CNSS) — overlays dossier data onto the real official
// scanned PDF forms in /public/feuilles/{cnops,cnss}.pdf.
//
// Coordinates live in each form's DISPLAY space (u = horizontal from left, v =
// vertical from top, in PDF points of the rotated/landscape view). They were
// measured directly from the scans' pixels via each PDF's image matrix, so text
// lands inside the printed boxes/circles. Only page 1 (client info) is filled.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, degrees, rgb } from "pdf-lib";

type XY = { u: number; v: number };
type BoxField = { u: number; v: number; pitch: number }; // first-box center u, baseline v

interface FormSpec {
  file: string;
  free: { assureNom: XY; adresse: XY; montant: XY; nombre: XY; benefNom: XY };
  boxes: { immat: BoxField; cinAssure: BoxField; dateNaiss: BoxField; cinBenef: BoxField; inp: BoxField };
  lien: { conjoint: XY; enfant: XY; luiMeme?: XY };
  sexe: { M: XY; F: XY };
  size: { free: number; box: number; check: number };
}

// CNOPS: mediabox 612x792, /Rotate 90. Measured from _img_cnops (1181x855).
const CNOPS: FormSpec = {
  file: "/feuilles/cnops.pdf",
  free: {
    assureNom: { u: 462, v: 148 },
    adresse: { u: 500, v: 232 },
    montant: { u: 500, v: 264 },
    nombre: { u: 500, v: 278 },
    benefNom: { u: 500, v: 311 },
  },
  boxes: {
    immat: { u: 544, v: 178, pitch: 11.0 },
    cinAssure: { u: 551, v: 191, pitch: 11.0 },
    dateNaiss: { u: 532, v: 328, pitch: 11.0 },
    cinBenef: { u: 532, v: 340, pitch: 11.0 },
    inp: { u: 525, v: 380, pitch: 11.0 },
  },
  lien: { conjoint: { u: 569, v: 219 }, enfant: { u: 637, v: 220 } },
  sexe: { M: { u: 552, v: 352 }, F: { u: 612, v: 352 } },
  size: { free: 9.6, box: 10, check: 11.5 },
};

// CNSS: mediabox 728.4x1031.76, /Rotate 270. Measured from _land_cnss (4299x3035).
const CNSS: FormSpec = {
  file: "/feuilles/cnss.pdf",
  free: {
    assureNom: { u: 665, v: 106 },
    adresse: { u: 679, v: 188 },
    montant: { u: 703, v: 213 },
    nombre: { u: 696, v: 232 },
    benefNom: { u: 710, v: 261 },
  },
  boxes: {
    immat: { u: 672, v: 131, pitch: 9.6 },
    cinAssure: { u: 816, v: 149, pitch: 9.6 },
    dateNaiss: { u: 792, v: 292, pitch: 9.6 },
    cinBenef: { u: 797, v: 312, pitch: 9.6 },
    inp: { u: 667, v: 365, pitch: 9.6 },
  },
  lien: { conjoint: { u: 734, v: 174 }, enfant: { u: 797, v: 175 }, luiMeme: { u: 875, v: 174 } },
  sexe: { M: { u: 842, v: 334 }, F: { u: 898, v: 334 } },
  size: { free: 9, box: 9, check: 11 },
};

const SPECS: Record<"CNOPS" | "CNSS", FormSpec> = { CNOPS, CNSS };

export interface FeuilleData {
  patientName: string;
  mutuelleNumero: string | null; // → N° Immatriculation
  patientCin: string | null;
  patientSexe: string | null; // 'M' | 'F'
  patientBirthDate: string | null; // 'YYYY-MM-DD'
  patientAddress: string | null;
  mutuelleLien: string | null;
  praticienInpe: string | null;
  montant: number;
}

// Map a page's /Rotate to a draw fn placing upright text at display coords (u,v).
function placer(page: PDFPage) {
  const r = page.getRotation().angle;
  const { width: mbW, height: mbH } = page.getSize();
  return (u: number, v: number): [number, number, number] => {
    if (r === 90) return [v, u, 90];
    if (r === 270) return [mbW - v, mbH - u, 270];
    if (r === 180) return [mbW - u, v, 180];
    return [u, mbH - v, 0];
  };
}

function lienKey(raw: string | null): "conjoint" | "enfant" | "luiMeme" | null {
  const s = (raw || "").toLowerCase();
  if (/conjoint|epoux|époux|epouse|épouse/.test(s)) return "conjoint";
  if (/enfant|fils|fille/.test(s)) return "enfant";
  if (/lui|soi|assur|titulaire|meme|même/.test(s)) return "luiMeme";
  return null;
}

export async function generateFeuilleSoins(insurer: "CNOPS" | "CNSS", data: FeuilleData): Promise<void> {
  const spec = SPECS[insurer];
  const bytes = await fetch(spec.file).then((r) => {
    if (!r.ok) throw new Error(`Formulaire ${insurer} introuvable`);
    return r.arrayBuffer();
  });
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.getPages()[0];
  const T = placer(page);
  const K = rgb(0, 0, 0);

  const left = (p: XY, text: string, size: number) => {
    if (!text) return;
    const [x, y, a] = T(p.u, p.v);
    page.drawText(text, { x, y, size, font, rotate: degrees(a), color: K });
  };
  const centered = (u: number, v: number, text: string, size: number) => {
    const w = font.widthOfTextAtSize(text, size);
    const [x, y, a] = T(u - w / 2, v);
    page.drawText(text, { x, y, size, font, rotate: degrees(a), color: K });
  };
  const boxes = (f: BoxField, text: string, size: number) => {
    if (!text) return;
    [...text].forEach((ch, i) => centered(f.u + i * f.pitch, f.v, ch, size));
  };

  const S = spec.size;
  // free-text fields (patient is both assuré and bénéficiaire when self-insured)
  left(spec.free.assureNom, data.patientName, S.free);
  left(spec.free.benefNom, data.patientName, S.free);
  if (data.patientAddress) left(spec.free.adresse, data.patientAddress, S.free);
  left(spec.free.montant, data.montant.toFixed(2), S.free);

  // box fields
  if (data.mutuelleNumero) boxes(spec.boxes.immat, digits(data.mutuelleNumero), S.box);
  if (data.patientCin) {
    boxes(spec.boxes.cinAssure, data.patientCin, S.box);
    boxes(spec.boxes.cinBenef, data.patientCin, S.box);
  }
  const dn = toDDMMYYYY(data.patientBirthDate);
  if (dn) boxes(spec.boxes.dateNaiss, dn, S.box);
  if (data.praticienInpe) boxes(spec.boxes.inp, data.praticienInpe, S.box);

  // checkboxes
  const lk = lienKey(data.mutuelleLien);
  if (lk && spec.lien[lk]) centered(spec.lien[lk]!.u, spec.lien[lk]!.v, "X", S.check);
  const sx = data.patientSexe === "M" ? spec.sexe.M : data.patientSexe === "F" ? spec.sexe.F : null;
  if (sx) centered(sx.u, sx.v, "X", S.check);

  const out = await doc.save();
  download(out, `feuille-soins-${insurer}-${data.patientName.replace(/\s+/g, "-")}.pdf`);
}

function digits(s: string): string {
  return s.replace(/\s+/g, "");
}
function toDDMMYYYY(iso: string | null): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}${m[2]}${m[1]}` : "";
}
function download(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
