"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sileo } from "sileo";

type DriveSyncButtonProps = {
  documentId: string;
  synced: boolean;
  disabled?: boolean;
};

export function DriveSyncButton({ documentId, synced, disabled = false }: DriveSyncButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function syncToDrive() {
    if (disabled) {
      sileo.warning({
        title: "Drive not configured",
        description: "Connect Drive and choose a location first.",
      });
      return;
    }

    setIsSubmitting(true);

    const response = await fetch(`/api/admin/document/${documentId}/drive`, {
      method: "POST",
    });

    const payload = (await response.json()) as { error?: string; webViewLink?: string };

    if (!response.ok) {
      sileo.error({
        title: "Drive sync failed",
        description: payload.error ?? "Drive sync failed",
      });
      setIsSubmitting(false);
      return;
    }

    sileo.success({
      title: synced ? "Drive file updated" : "Saved to Google Drive",
      description: "Document is now available in the selected Drive location.",
    });
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void syncToDrive()}
        disabled={isSubmitting || disabled}
        className="rounded-lg border border-[color:var(--navy)]/25 px-3 py-1 text-xs font-semibold text-[color:var(--navy)] transition hover:bg-[color:var(--paper-soft)] disabled:opacity-60"
      >
        {isSubmitting
          ? "Syncing..."
          : disabled
            ? "Configure Drive first"
            : synced
              ? "Re-sync to Drive"
              : "Save to Drive"}
      </button>
    </div>
  );
}
