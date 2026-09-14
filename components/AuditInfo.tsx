"use client";

import { useTranslations } from "next-intl";
import LocalInstant from "@/components/LocalInstant";
import { useMemberName } from "@/components/AppContext";

// Shows "Créé par {name} · {date}" and, when the record has since been edited,
// "Modifié par {name} · {date}". Names are resolved from the practice members in
// AppContext; a missing/unknown id renders nothing rather than a raw uuid.
//
// `compact` renders a single tiny "Créé par {name}" line for dense list rows.
export default function AuditInfo({
  createdBy,
  createdAt,
  updatedBy,
  updatedAt,
  compact = false,
  className = "",
}: {
  createdBy?: string | null;
  createdAt?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("audit");
  const creatorName = useMemberName(createdBy);
  const editorName = useMemberName(updatedBy);

  // Only surface "Modifié par" for a real, distinct edit: an updated_by that
  // resolves to a name and an updatedAt strictly later than createdAt (the
  // trigger stamps updated_at = now() on every update, so a row that was never
  // edited keeps updatedAt == createdAt, give or take insert latency).
  const edited =
    !!editorName && !!updatedAt && !!createdAt &&
    new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 1000;

  if (compact) {
    if (!creatorName) return null;
    return (
      <span className={`text-[11px] text-zinc-400 dark:text-zinc-500 ${className}`}>
        {t("createdByName", { name: creatorName })}
      </span>
    );
  }

  if (!creatorName && !edited) return null;

  return (
    <div className={`text-[11px] text-zinc-400 dark:text-zinc-500 space-y-0.5 ${className}`}>
      {creatorName && (
        <p>
          {t("createdByName", { name: creatorName })}
          {createdAt && <> · <LocalInstant iso={createdAt} /></>}
        </p>
      )}
      {edited && (
        <p>
          {t("modifiedByName", { name: editorName })} · <LocalInstant iso={updatedAt} />
        </p>
      )}
    </div>
  );
}
