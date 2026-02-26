"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { sileo } from "sileo";

type QuestionAnswerFormProps = {
  questionId: string;
};

export function QuestionAnswerForm({ questionId }: QuestionAnswerFormProps) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const response = await fetch(`/api/client/question/${questionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      sileo.error({
        title: "Could not submit answer",
        description: payload.error ?? "Could not submit answer",
      });
      setIsSubmitting(false);
      return;
    }

    sileo.success({
      title: "Answer submitted",
      description: "Your response has been sent.",
    });
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <textarea
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        required
        rows={3}
        placeholder="Type your answer..."
        className="w-full rounded-xl border border-[color:var(--navy)]/20 bg-white px-3 py-2 text-sm outline-none ring-[color:var(--navy)] transition focus:ring"
      />
      <button
        type="submit"
        disabled={!answer.trim() || isSubmitting}
        className="rounded-xl bg-[color:var(--navy)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--navy-soft)] disabled:opacity-60"
      >
        {isSubmitting ? "Submitting..." : "Submit answer"}
      </button>
    </form>
  );
}
