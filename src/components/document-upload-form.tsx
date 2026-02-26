"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { sileo } from "sileo";

type DocumentUploadFormProps = {
  requestId: string;
};

export function DocumentUploadForm({ requestId }: DocumentUploadFormProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      sileo.warning({
        title: "No file selected",
        description: "Choose a document before uploading.",
      });
      return;
    }

    setIsUploading(true);

    const data = new FormData();
    data.append("file", file);

    const response = await fetch(`/api/client/request/${requestId}/upload`, {
      method: "POST",
      body: data,
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      sileo.error({
        title: "Upload failed",
        description: payload.error ?? "Upload failed",
      });
      setIsUploading(false);
      return;
    }

    sileo.success({
      title: "Uploaded",
      description: `${file.name} is now in the diligence room.`,
    });

    setFile(null);
    setIsUploading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleUpload} className="space-y-2">
      <label className="inline-flex cursor-pointer items-center rounded-lg border border-[color:var(--navy)]/25 px-3 py-2 text-xs font-semibold text-[color:var(--navy)] hover:bg-[color:var(--paper-soft)]">
        <input
          type="file"
          className="hidden"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
        />
        {file ? file.name : "Choose file"}
      </label>
      <button
        type="submit"
        disabled={!file || isUploading}
        className="w-full rounded-lg bg-[color:var(--navy)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[color:var(--navy-soft)] disabled:opacity-60"
      >
        {isUploading ? "Uploading..." : "Upload document"}
      </button>
    </form>
  );
}
