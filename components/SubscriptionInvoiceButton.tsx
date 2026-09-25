"use client";

// Download button for one subscription invoice (admin pages + Paramètres → Abonnement).

import { useState } from "react";
import type { SubscriptionInvoiceRow } from "@/utils/subscription";

export default function SubscriptionInvoiceButton({ invoice, practiceName, practiceAddress, practicePhone, label }: {
  invoice: SubscriptionInvoiceRow;
  practiceName: string;
  practiceAddress?: string | null;
  practicePhone?: string | null;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const { exportSubscriptionInvoicePdf } = await import("@/utils/subscription-pdf");
      await exportSubscriptionInvoicePdf({ invoice, practiceName, practiceAddress, practicePhone });
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" onClick={download} disabled={busy}
      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-teal-400 hover:text-teal-600 disabled:opacity-50 whitespace-nowrap">
      {busy ? "…" : `📄 ${label}`}
    </button>
  );
}
