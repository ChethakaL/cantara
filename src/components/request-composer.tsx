"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { sileo } from "sileo";
import { DatePicker } from "./date-picker";

type RequestComposerProps = {
  clientId: string;
};

export function RequestComposer({ clientId }: RequestComposerProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingStandard, setIsAddingStandard] = useState(false);

  async function createStandardRequests() {
    setIsAddingStandard(true);

    const response = await fetch(`/api/admin/client/${clientId}/requests/standard`, {
      method: "POST",
    });

    const payload = (await response.json()) as { error?: string; created?: number };

    if (!response.ok) {
      sileo.error({
        title: "Could not add standard requests",
        description: payload.error ?? "Could not add standard requests",
      });
      setIsAddingStandard(false);
      return;
    }

    sileo.success({
      title: "Standard requests added",
      description: `${payload.created ?? 0} request(s) were created for this client.`,
    });
    setIsAddingStandard(false);
    router.refresh();
  }

  async function createCustomRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const response = await fetch(`/api/admin/client/${clientId}/requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, description, dueDate }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      sileo.error({
        title: "Could not create request",
        description: payload.error ?? "Could not create request",
      });
      setIsSubmitting(false);
      return;
    }

    setTitle("");
    setDescription("");
    setDueDate("");
    sileo.success({
      title: "Request created",
      description: "Client can now upload this document.",
    });
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => void createStandardRequests()}
        disabled={isAddingStandard}
        className="w-full rounded-xl bg-[color:var(--navy)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--navy-soft)] disabled:opacity-60"
      >
        {isAddingStandard ? "Adding..." : "Add standard requests (Business registration + Business plan)"}
      </button>

      <form onSubmit={createCustomRequest} className="space-y-3 rounded-2xl border border-[color:var(--navy)]/15 bg-white/70 p-4">
        <h3 className="text-sm font-semibold text-[color:var(--navy)]">Create custom request</h3>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          placeholder="Example: Last 2 years audited financial statements"
          className="w-full rounded-xl border border-[color:var(--navy)]/20 bg-white px-3 py-2 text-sm outline-none ring-[color:var(--navy)] transition focus:ring"
        />
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="Optional details for the client"
          className="w-full rounded-xl border border-[color:var(--navy)]/20 bg-white px-3 py-2 text-sm outline-none ring-[color:var(--navy)] transition focus:ring"
        />
        <div>
          <label htmlFor="due-date" className="mb-1 block text-xs font-semibold tracking-[0.12em] text-[color:var(--ink-soft)] uppercase">
            Due date (optional)
          </label>
          <DatePicker
            id="due-date"
            value={dueDate}
            onChange={setDueDate}
            placeholder="Select due date"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl border border-[color:var(--navy)]/25 px-4 py-2 text-sm font-semibold text-[color:var(--navy)] transition hover:bg-[color:var(--paper-soft)] disabled:opacity-60"
        >
          {isSubmitting ? "Creating..." : "Create request"}
        </button>
      </form>
    </div>
  );
}
