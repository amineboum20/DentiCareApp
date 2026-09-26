// Feuille de soins (CNOPS / CNSS) — overlays dossier data onto the real official
// scanned PDF forms in /public/feuilles/{cnops,cnss}.pdf.
//
// Coordinates live in each form's DISPLAY space (u = horizontal from left, v =
// vertical from top, in PDF points of the rotated/landscape view — the same
// space PyMuPDF renders). Re-measured 2026-09-26 on a 10x render of each scan:
// box rows from the detected vertical ticks (first-box centre + pitch, or the
// explicit centres when a row is split into groups), text baselines ~1.2pt above
// the dotted line / box bottom line, check marks centred on the printed
// square/circle. Only page 1 (client info) is filled.

import { PDFDocument, PDFPage, StandardFonts, degrees, rgb } from "pdf-lib";

type XY = { u: number; v: number };
// Box row: `v` = text baseline; either first-box centre `u` + `pitch`, or the
// explicit box `centers` (rows printed in groups, e.g. the CNSS date JJ MM AAAA).
type BoxField = { v: number; u?: number; pitch?: number; centers?: number[] };

interface FormSpec {
  file: string;
  free: { assureNom: XY; adresse: XY; montant: XY; benefNom: XY };
  boxes: { immat: BoxField; cinAssure: BoxField; dateNaiss: BoxField; cinBenef: BoxField; inp: BoxField };
  dateFormat: "DDMMYYYY" | "DDMMYY"; // CNOPS prints only 6 date boxes
  lien: { conjoint: XY; enfant: XY; luiMeme?: XY };
  sexe: { M: XY; F: XY };
  size: { free: number; box: number; check: number };
}

// CNOPS: mediabox 612x792, /Rotate 90 → display 792x612. Boxes are light grey.
const CNOPS: FormSpec = {
  file: "/feuilles/cnops.pdf",
  free: {
    assureNom: { u: 478, v: 147.9 },
    adresse: { u: 452, v: 229.4 },
    montant: { u: 512, v: 257.1 },
    benefNom: { u: 480, v: 309.2 },
  },
  boxes: {
    immat: { u: 545.8, v: 175.0, pitch: 9.56 },     // 9 boxes 540.6–626.6
    cinAssure: { u: 550.5, v: 188.4, pitch: 9.46 }, // 8 boxes 545.8–621.5
    dateNaiss: { u: 559.8, v: 322.8, pitch: 9.55 }, // 6 boxes JJMMAA 555.0–612.3
    cinBenef: { u: 550.2, v: 335.0, pitch: 9.48 },  // 8 boxes 545.4–621.2
    inp: { u: 502.8, v: 378.5, pitch: 9.59 },       // 9 boxes 498.1–584.4
  },
  dateFormat: "DDMMYY",
  lien: { conjoint: { u: 566.1, v: 219.3 }, enfant: { u: 638.9, v: 219.3 } },
  sexe: { M: { u: 553.5, v: 352.3 }, F: { u: 607.7, v: 352.3 } },
  size: { free: 9.6, box: 9.5, check: 11.5 },
};

// CNSS: mediabox 728.4x1031.76, /Rotate 270 → display 1031.76x728.4.
const CNSS: FormSpec = {
  file: "/feuilles/cnss.pdf",
  free: {
    assureNom: { u: 655, v: 107.0 },
    adresse: { u: 668, v: 186.3 },
    montant: { u: 700, v: 213.6 },
    benefNom: { u: 660, v: 274.2 },
  },
  boxes: {
    immat: { u: 674.5, v: 127.4, pitch: 9.95 },     // 9 boxes 669.5–759.2
    cinAssure: { u: 818.0, v: 142.1, pitch: 9.97 }, // 9 boxes 813.0–903.0
    dateNaiss: { v: 289.7, centers: [775.5, 785.5, 800.2, 810.3, 823.6, 834.1, 844.5, 854.9] }, // JJ MM AAAA
    cinBenef: { u: 783.6, v: 311.5, pitch: 9.98 },  // 9 boxes 778.5–868.7
    inp: { u: 631.1, v: 366.0, pitch: 9.96 },       // 9 boxes 626.1–716.0
  },
  dateFormat: "DDMMYYYY",
  lien: { conjoint: { u: 734.3, v: 173.5 }, enfant: { u: 801.8, v: 173.5 }, luiMeme: { u: 876.0, v: 173.5 } },
  sexe: { M: { u: 841.9, v: 331.4 }, F: { u: 896.8, v: 331.4 } },
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
  montant: number | null; // null = leave the amount blank
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

// Fills page 1 of the official form and returns the PDF bytes (no browser APIs,
// so it can also run in Node — used by the marketing Reel generator).
export async function buildFeuilleSoinsPdf(
  insurer: "CNOPS" | "CNSS",
  data: FeuilleData,
  formBytes: ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  const spec = SPECS[insurer];
  const doc = await PDFDocument.load(formBytes);
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
    [...text].forEach((ch, i) => {
      const u = f.centers ? f.centers[i] : (f.u ?? 0) + i * (f.pitch ?? 0);
      if (u !== undefined) centered(u, f.v, ch, size); // extra chars beyond the printed boxes are dropped
    });
  };
  // Centre of a check mark: capital X baseline sits ~cap-height/2 below the box centre.
  const check = (p: XY) => centered(p.u, p.v, "X", spec.size.check);

  const S = spec.size;
  // free-text fields (patient is both assuré and bénéficiaire when self-insured)
  left(spec.free.assureNom, data.patientName, S.free);
  left(spec.free.benefNom, data.patientName, S.free);
  if (data.patientAddress) left(spec.free.adresse, data.patientAddress, S.free);
  if (data.montant !== null && Number.isFinite(data.montant)) left(spec.free.montant, data.montant.toFixed(2), S.free);

  // box fields
  if (data.mutuelleNumero) boxes(spec.boxes.immat, digits(data.mutuelleNumero), S.box);
  if (data.patientCin) {
    const cin = digits(data.patientCin).toUpperCase();
    boxes(spec.boxes.cinAssure, cin, S.box);
    boxes(spec.boxes.cinBenef, cin, S.box);
  }
  const dn = formatDate(data.patientBirthDate, spec.dateFormat);
  if (dn) boxes(spec.boxes.dateNaiss, dn, S.box);
  if (data.praticienInpe) boxes(spec.boxes.inp, digits(data.praticienInpe), S.box);

  // checkboxes
  const lk = lienKey(data.mutuelleLien);
  if (lk && spec.lien[lk]) check(spec.lien[lk]!);
  const sx = data.patientSexe === "M" ? spec.sexe.M : data.patientSexe === "F" ? spec.sexe.F : null;
  if (sx) check(sx);

  return doc.save();
}

export async function generateFeuilleSoins(insurer: "CNOPS" | "CNSS", data: FeuilleData): Promise<void> {
  const bytes = await fetch(SPECS[insurer].file).then((r) => {
    if (!r.ok) throw new Error(`Formulaire ${insurer} introuvable`);
    return r.arrayBuffer();
  });
  const out = await buildFeuilleSoinsPdf(insurer, data, bytes);
  download(out, `feuille-soins-${insurer}-${data.patientName.replace(/\s+/g, "-")}.pdf`);
}

function digits(s: string): string {
  return s.replace(/\s+/g, "");
}
function formatDate(iso: string | null, fmt: FormSpec["dateFormat"]): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return fmt === "DDMMYY" ? `${m[3]}${m[2]}${m[1].slice(2)}` : `${m[3]}${m[2]}${m[1]}`;
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
