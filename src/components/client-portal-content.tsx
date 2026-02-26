"use client";

import { format } from "date-fns";
import { motion } from "framer-motion";
import { DocumentDeleteButton } from "./document-delete-button";
import { DocumentUploadForm } from "./document-upload-form";
import { QuestionAnswerForm } from "./question-answer-form";
import { StageBadge } from "./stage-badge";

type Request = {
  id: string;
  title: string;
  description: string | null;
  createdAt: Date;
  dueDate: Date | null;
  documents: Array<{
    id: string;
    fileName: string;
    createdAt: Date;
  }>;
};

type Question = {
  id: string;
  question: string;
  answer: string | null;
  createdAt: Date;
  answeredAt: Date | null;
};

type Props = {
  profile: {
    businessName: string;
    businessDescription: string;
    stage: string;
    createdAt: Date;
    requests: Request[];
    questions: Question[];
  };
};

export function ClientPortalContent({ profile }: Props) {
  return (
    <>
      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <motion.article
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="fin-card rounded-2xl border border-[color:var(--navy)]/8 bg-white p-8 shadow-sm"
        >
          <h2 className="font-display text-2xl text-[color:var(--navy)] sm:text-3xl">
            {profile.businessName}
          </h2>
          <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
            Submitted on {format(profile.createdAt, "MMMM d, yyyy")}
          </p>
          <p className="mt-5 rounded-xl border border-[color:var(--navy)]/10 bg-[color:var(--paper)]/80 p-5 text-sm leading-relaxed text-[color:var(--ink)]">
            {profile.businessDescription}
          </p>
        </motion.article>

        <motion.article
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="fin-card rounded-2xl border border-[color:var(--navy)]/8 bg-white p-6 shadow-sm"
        >
          <p className="text-xs font-semibold tracking-[0.16em] text-[color:var(--ink-soft)] uppercase">
            Current stage
          </p>
          <div className="mt-3">
            <StageBadge stage={profile.stage as "INITIAL_REVIEW" | "IN_PROGRESS" | "COMPLETED"} />
          </div>
          <p className="mt-5 text-sm leading-relaxed text-[color:var(--ink-soft)]">
            Your stage is updated by the Cantara admin team as diligence progresses.
          </p>
        </motion.article>
      </section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12 }}
        className="mt-10 space-y-4"
      >
        <h2 className="font-display text-2xl text-[color:var(--navy)] sm:text-3xl">
          Requested Documents
        </h2>
        {profile.requests.length === 0 ? (
          <motion.article
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="fin-card rounded-2xl border-2 border-dashed border-[color:var(--navy)]/15 p-12 text-center"
          >
            <p className="text-sm text-[color:var(--ink-soft)]">
              No document requests yet. The admin team will add them shortly.
            </p>
          </motion.article>
        ) : (
          profile.requests.map((request, i) => (
            <motion.article
              key={request.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 + i * 0.05 }}
              whileHover={{ y: -2 }}
              className="fin-card rounded-2xl border border-[color:var(--navy)]/8 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-[color:var(--navy)]">
                    {request.title}
                  </h3>
                  <p className="mt-1 text-xs text-[color:var(--ink-soft)]">
                    Requested on {format(request.createdAt, "MMM d, yyyy")}
                    {request.dueDate ? ` | Due ${format(request.dueDate, "MMM d, yyyy")}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                    request.documents.length > 0
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {request.documents.length > 0 ? "Uploaded" : "Pending"}
                </span>
              </div>

              {request.description ? (
                <p className="mt-4 text-sm leading-relaxed text-[color:var(--ink-soft)]">
                  {request.description}
                </p>
              ) : null}

              <div className="mt-6 grid gap-4 md:grid-cols-[2fr_1fr]">
                <div className="rounded-xl border border-[color:var(--navy)]/10 bg-[color:var(--paper)]/60 p-4">
                  <p className="text-xs font-semibold tracking-[0.12em] text-[color:var(--ink-soft)] uppercase">
                    Your uploads
                  </p>
                  {request.documents.length === 0 ? (
                    <p className="mt-2 text-sm text-[color:var(--ink-soft)]">No file uploaded yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {request.documents.map((doc) => (
                        <li
                          key={doc.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--navy)]/8 bg-white/70 p-2"
                        >
                          <div className="text-sm font-medium text-[color:var(--navy)]">
                            {doc.fileName}
                            <span className="ml-2 text-xs font-normal text-[color:var(--ink-soft)]">
                              ({format(doc.createdAt, "MMM d, h:mm a")})
                            </span>
                          </div>
                          <DocumentDeleteButton documentId={doc.id} fileName={doc.fileName} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-xl border border-[color:var(--navy)]/10 bg-[color:var(--paper)]/60 p-4">
                  <p className="mb-3 text-xs font-semibold tracking-[0.12em] text-[color:var(--ink-soft)] uppercase">
                    Upload response
                  </p>
                  <DocumentUploadForm requestId={request.id} />
                </div>
              </div>
            </motion.article>
          ))
        )}
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mt-12 space-y-4"
      >
        <h2 className="font-display text-2xl text-[color:var(--navy)] sm:text-3xl">
          Questions from Cantara
        </h2>
        {profile.questions.length === 0 ? (
          <motion.article
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="fin-card rounded-2xl border-2 border-dashed border-[color:var(--navy)]/15 p-12 text-center"
          >
            <p className="text-sm text-[color:var(--ink-soft)]">
              No questions yet. The Cantara team may reach out with questions about your business or
              diligence materials.
            </p>
          </motion.article>
        ) : (
          profile.questions.map((q, i) => (
            <motion.article
              key={q.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.25 + i * 0.05 }}
              className="fin-card rounded-2xl border border-[color:var(--navy)]/8 bg-white p-6 shadow-sm"
            >
              <p className="font-semibold text-[color:var(--navy)]">
                {(q.question ?? "").replace(/^undefined/, "")}
              </p>
              <p className="mt-1 text-xs text-[color:var(--ink-soft)]">
                Asked on {format(q.createdAt, "MMM d, yyyy")}
              </p>
              {q.answer ? (
                <div className="mt-5 rounded-xl border border-[color:var(--navy)]/10 bg-[color:var(--navy-light)]/40 p-5">
                  <p className="text-xs font-semibold tracking-[0.08em] text-[color:var(--ink-soft)] uppercase">
                    Your response
                  </p>
                  <p className="mt-2 text-sm text-[color:var(--ink)]">{q.answer}</p>
                  <p className="mt-2 text-xs text-[color:var(--ink-soft)]">
                    Submitted on {q.answeredAt ? format(q.answeredAt, "MMM d, yyyy h:mm a") : "—"}
                  </p>
                </div>
              ) : (
                <QuestionAnswerForm questionId={q.id} />
              )}
            </motion.article>
          ))
        )}
      </motion.section>
    </>
  );
}
