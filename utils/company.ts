// MediCareApp — the company that bills the subscription (OptiCareApp and
// DentiCare are its two products). Printed on the subscription invoices.
//
// ⚠️ PLACEHOLDER DATA — replace with the real legal details once the company
// is registered (raison sociale, adresse, ICE, IF, RC, patente, RIB, TVA).
// Keep this file identical in both apps.
export const COMPANY = {
  name: "MediCareApp SARL",
  address: "123, boulevard Exemple",
  city: "20000 Casablanca, Maroc",
  email: "facturation@medicareapp.com",
  phone: "+212 5 00 00 00 00",
  ice: "000000000000000",
  if: "00000000",
  rc: "000000",
  patente: "00000000",
  bank: "Banque Exemple",
  rib: "000 000 0000000000000000 00",
  placeholder: true, // → prints "Données provisoires" on the invoice
} as const;

export const PLAN_LABEL: Record<string, string> = { standard: "Standard" };
