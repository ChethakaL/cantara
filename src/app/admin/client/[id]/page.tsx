import { Role } from "@prisma/client";
import { format } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DriveSyncButton } from "@/components/drive-sync-button";
import { PortalShell } from "@/components/portal-shell";
import { QuestionComposer } from "@/components/question-composer";
import { RequestComposer } from "@/components/request-composer";
import { StageBadge } from "@/components/stage-badge";
import { StageSelector } from "@/components/stage-selector";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminClientPage({ params }: Props) {
  const admin = await requireUser(Role.ADMIN);
  const { id } = await params;
  const driveReady = Boolean(admin.googleRefreshToken || admin.googleAccessToken);

  const [client, questions] = await Promise.all([
    prisma.clientProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        requests: {
          include: {
            documents: {
              include: {
                uploadedBy: {
                  select: {
                    name: true,
                  },
                },
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    }),
    prisma.question.findMany({
      where: { clientId: id },
      include: { askedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!client) {
    notFound();
  }

  const uploadedDocuments = client.requests.flatMap((request) => request.documents);
  const reviewedDocuments = uploadedDocuments.filter((doc) => Boolean(doc.aiReviewStatus));
  const redFlagDocuments = uploadedDocuments.filter((doc) => doc.aiReviewStatus === "RED_FLAG");

  return (
    <PortalShell
      heading={client.businessName}
      subheading="Client diligence room"
      userLabel={admin.name}
      roleLabel="Administrator"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin"
          className="rounded-lg border border-[color:var(--navy)]/20 px-3 py-2 text-sm font-semibold text-[color:var(--navy)] hover:bg-white/80"
        >
          Back to board
        </Link>
        <StageBadge stage={client.stage} />
      </div>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <article className="fin-card animate-rise rounded-2xl p-5">
          <h2 className="font-display text-3xl text-[color:var(--navy)]">Business Overview</h2>
          <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
            Submitted by {client.user.name} ({client.user.email}) on {format(client.createdAt, "MMM d, yyyy")}
          </p>
          <p className="mt-4 rounded-xl border border-[color:var(--navy)]/10 bg-white/70 p-4 text-sm leading-relaxed text-[color:var(--ink)]">
            {client.businessDescription}
          </p>
          <div className="mt-4 rounded-xl border border-[color:var(--navy)]/10 bg-[color:var(--navy-light)]/45 p-4">
            <p className="text-xs font-semibold tracking-[0.08em] text-[color:var(--ink-soft)] uppercase">AI Review</p>
            {uploadedDocuments.length === 0 ? (
              <p className="mt-2 text-sm text-[color:var(--ink-soft)]">No uploads yet, so no AI review yet.</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
                  Reviewed {reviewedDocuments.length} of {uploadedDocuments.length} upload(s). Red flags:{" "}
                  {redFlagDocuments.length}.
                </p>
                {redFlagDocuments.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {redFlagDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900"
                      >
                        <p className="font-semibold">{doc.fileName}</p>
                        <p className="mt-1">{doc.aiReviewSummary ?? "Potential mismatch detected."}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                    No red-flag uploads based on keyword/type/name checks.
                  </p>
                )}
              </>
            )}
          </div>
        </article>

        <article className="fin-card animate-rise animate-delay-1 rounded-2xl p-5">
          <StageSelector clientId={client.id} stage={client.stage} />
          <div className="mt-5 border-t border-[color:var(--navy)]/10 pt-5">
            <RequestComposer clientId={client.id} />
          </div>
        </article>
      </section>

      <section className="mt-6 space-y-4">
        <h2 className="font-display text-3xl text-[color:var(--navy)]">Document Requests</h2>
        {!driveReady ? (
          <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Google Drive sync is not fully configured. In the Admin Portal, connect Google Drive and select a
            Drive location first.
          </p>
        ) : null}
        {client.requests.length === 0 ? (
          <article className="fin-card rounded-2xl border border-dashed p-8 text-sm text-[color:var(--ink-soft)]">
            No requests created for this client yet.
          </article>
        ) : (
          client.requests.map((request) => (
            <article key={request.id} className="fin-card fin-interactive rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-[color:var(--navy)]">{request.title}</h3>
                  <p className="mt-1 text-xs text-[color:var(--ink-soft)]">
                    Requested on {format(request.createdAt, "MMM d, yyyy")}
                    {request.dueDate ? ` | Due ${format(request.dueDate, "MMM d, yyyy")}` : ""}
                  </p>
                  {request.description ? (
                    <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-soft)]">{request.description}</p>
                  ) : null}
                </div>
                <span className="rounded-full bg-[color:var(--navy)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--navy)]">
                  {request.documents.length} upload(s)
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {request.documents.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[color:var(--navy)]/20 p-3 text-xs text-[color:var(--ink-soft)]">
                    Waiting for client upload.
                  </p>
                ) : (
                  request.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--navy)]/10 bg-white/70 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--navy)]">{doc.fileName}</p>
                        <p className="text-xs text-[color:var(--ink-soft)]">
                          Uploaded by {doc.uploadedBy.name} on {format(doc.createdAt, "MMM d, yyyy h:mm a")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span
                            className={
                              doc.aiReviewStatus === "RED_FLAG"
                                ? "rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800"
                                : doc.aiReviewStatus === "PASS"
                                  ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
                                  : "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                            }
                          >
                            {doc.aiReviewStatus === "RED_FLAG"
                              ? "AI Red Flag"
                              : doc.aiReviewStatus === "PASS"
                                ? "AI Pass"
                                : "AI Pending"}
                          </span>
                          {doc.aiDetectedType ? (
                            <span className="rounded-full bg-[color:var(--navy)]/10 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--navy)]">
                              Type: {doc.aiDetectedType.replaceAll("_", " ").toLowerCase()}
                            </span>
                          ) : null}
                        </div>
                        {doc.aiReviewSummary ? (
                          <p className="mt-2 text-xs text-[color:var(--ink-soft)]">{doc.aiReviewSummary}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/api/document/${doc.id}/download`}
                          target="_blank"
                          className="rounded-lg border border-[color:var(--navy)]/25 px-3 py-1 text-xs font-semibold text-[color:var(--navy)] transition hover:bg-[color:var(--paper-soft)]"
                        >
                          Open file
                        </Link>
                        <DriveSyncButton
                          documentId={doc.id}
                          synced={Boolean(doc.googleDriveFileId)}
                          disabled={!driveReady}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          ))
        )}
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="font-display text-3xl text-[color:var(--navy)]">Q&amp;A with Client</h2>
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <article className="fin-card rounded-2xl border border-[color:var(--navy)]/8 p-5">
            <h3 className="text-sm font-semibold text-[color:var(--navy)]">Ask a question</h3>
            <p className="mt-1 text-xs text-[color:var(--ink-soft)]">
              The client will see your question in their portal and can reply.
            </p>
            <div className="mt-4">
              <QuestionComposer clientId={client.id} />
            </div>
          </article>
          <div className="space-y-3">
            {questions.length === 0 ? (
              <article className="fin-card rounded-2xl border border-dashed border-[color:var(--navy)]/20 p-8 text-sm text-[color:var(--ink-soft)]">
                No questions yet. Ask the client anything about their business or diligence.
              </article>
            ) : (
              questions.map((q) => (
                <article
                  key={q.id}
                  className="fin-card rounded-2xl border border-[color:var(--navy)]/8 p-5"
                >
                  <p className="text-sm font-semibold text-[color:var(--navy)]">
                    {(q.question ?? "").replace(/^undefined/, "")}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--ink-soft)]">
                    Asked by {q.askedBy.name} on {format(q.createdAt, "MMM d, yyyy h:mm a")}
                  </p>
                  {q.answer ? (
                    <div className="mt-4 rounded-xl border border-[color:var(--navy)]/10 bg-[color:var(--navy-light)]/50 p-4">
                      <p className="text-xs font-semibold tracking-[0.08em] text-[color:var(--ink-soft)] uppercase">
                        Client response
                      </p>
                      <p className="mt-2 text-sm text-[color:var(--ink)]">{q.answer}</p>
                      <p className="mt-2 text-xs text-[color:var(--ink-soft)]">
                        Answered on {q.answeredAt ? format(q.answeredAt, "MMM d, yyyy h:mm a") : "—"}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-[color:var(--ink-soft)]">Awaiting client response.</p>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </PortalShell>
  );
}
