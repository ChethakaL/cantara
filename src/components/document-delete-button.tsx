"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sileo } from "sileo";

type DocumentDeleteButtonProps = {
  documentId: string;
  fileName: string;
};

export function DocumentDeleteButton({ documentId, fileName }: DocumentDeleteButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete \"${fileName}\"? This cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);

    const response = await fetch(`/api/client/document/${documentId}`, {
      method: "DELETE",
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      sileo.error({
        title: "Delete failed",
        description: payload.error ?? "Could not delete the document.",
      });
      setIsDeleting(false);
      return;
    }

    sileo.success({
      title: "Document deleted",
      description: `${fileName} was removed.`,
    });

    setIsDeleting(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void handleDelete()}
      disabled={isDeleting}
      className="rounded-md border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
    >
      {isDeleting ? "Deleting..." : "Delete"}
    </button>
  );
}
