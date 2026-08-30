"use client";

import { rejectMember } from "./actions";

export default function MemberRejectButton({ memberId, memberName }: { memberId: string; memberName: string }) {
  return (
    <form
      action={rejectMember}
      onSubmit={(e) => {
        if (
          !confirm(
            `Refuser et supprimer définitivement « ${memberName || "ce membre"} » ?\n\nLe compte sera supprimé. La personne pourra être réinvitée avec le même e-mail.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="member_id" value={memberId} />
      <button className="rounded-xl border border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 text-sm font-semibold px-4 py-2.5 whitespace-nowrap transition">
        Refuser
      </button>
    </form>
  );
}
