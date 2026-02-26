"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { sileo } from "sileo";

type QuestionComposerProps = {
  clientId: string;
};

export function QuestionComposer({ clientId }: QuestionComposerProps) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const response = await fetch(`/api/admin/client/${clientId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      sileo.error({
        title: "Could not send question",
        description: payload.error ?? "Could not send question",
      });
      setIsSubmitting(false);
      return;
    }

    setQuestion("");
    sileo.success({
      title: "Question sent",
      description: "The client will see it in their portal.",
    });
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        required
        rows={3}
        placeholder="Ask the client a question..."
        className="w-full rounded-xl border border-[color:var(--navy)]/20 bg-white px-3 py-2 text-sm outline-none ring-[color:var(--navy)] transition focus:ring"
      />
      <button
        type="submit"
        disabled={!question.trim() || isSubmitting}
        className="w-full rounded-xl bg-[color:var(--navy)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--navy-soft)] disabled:opacity-60"
      >
        {isSubmitting ? "Sending..." : "Ask question"}
      </button>
    </form>
  );
}
