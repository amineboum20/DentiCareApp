"use client";

import { rejectPractice } from "./actions";

export default function RejectButton({ practiceId, shopName }: { practiceId: string; shopName: string }) {
  return (
    <form
      action={rejectPractice}
      onSubmit={(e) => {
        if (
          !confirm(
            `Refuser et supprimer définitivement « ${shopName || "ce cabinet"} » ?\n\nLe compte et ses données seront supprimés. L'utilisateur pourra se réinscrire avec le même e-mail.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="practice_id" value={practiceId} />
      <button className="rounded-xl border border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 text-sm font-semibold px-4 py-2.5 whitespace-nowrap transition">
        Refuser
      </button>
    </form>
  );
}
