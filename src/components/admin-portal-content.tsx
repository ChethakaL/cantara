"use client";

import { ClientStage } from "@prisma/client";
import Link from "next/link";
import { motion } from "framer-motion";
import { AdminFlashToasts } from "./admin-flash-toasts";
import { GoogleDriveConfig } from "./google-drive-config";
import { StageBadge } from "./stage-badge";
import { stageLabels } from "@/lib/constants";

const orderedStages: ClientStage[] = ["INITIAL_REVIEW", "IN_PROGRESS", "COMPLETED"];

type Client = {
  id: string;
  businessName: string;
  stage: ClientStage;
  user: { name: string };
  _count: { requests: number; documents: number };
};

type Props = {
  clients: Client[];
  isDriveConnected: boolean;
  selectedFolderId: string | null;
  selectedFolderName: string | null;
  driveFolders: Array<{ id: string; name: string }>;
  driveFolderLoadError: string | null;
};

export function AdminPortalContent({
  clients,
  isDriveConnected,
  selectedFolderId,
  selectedFolderName,
  driveFolders,
  driveFolderLoadError,
}: Props) {
  const grouped = orderedStages.map((stage) => ({
    stage,
    clients: clients.filter((c) => c.stage === stage),
  }));

  return (
    <>
      <AdminFlashToasts />
      <GoogleDriveConfig
        isConnected={isDriveConnected}
        selectedFolderId={selectedFolderId}
        selectedFolderName={selectedFolderName}
        folders={driveFolders}
        loadError={driveFolderLoadError}
      />

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8 grid gap-4 sm:grid-cols-3"
      >
        {orderedStages.map((stage, i) => (
          <motion.article
            key={stage}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.05 }}
            whileHover={{ y: -2, boxShadow: "0 12px 24px -12px rgba(12, 25, 41, 0.15)" }}
            className="fin-card rounded-2xl border border-[color:var(--navy)]/8 bg-white p-6 shadow-sm transition-shadow"
          >
            <p className="text-xs font-semibold tracking-[0.16em] text-[color:var(--ink-soft)] uppercase">
              {stageLabels[stage]}
            </p>
            <p className="mt-3 text-4xl font-bold tabular-nums text-[color:var(--navy)]">
              {clients.filter((c) => c.stage === stage).length}
            </p>
            <p className="mt-1 text-sm text-[color:var(--ink-soft)]">client profile(s)</p>
          </motion.article>
        ))}
      </motion.section>

      <section className="grid gap-6 lg:grid-cols-3">
        {grouped.map((group, groupIndex) => (
          <motion.article
            key={group.stage}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 + groupIndex * 0.08 }}
            className="fin-card rounded-2xl border border-[color:var(--navy)]/8 bg-white p-5 shadow-sm"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-xl text-[color:var(--navy)] sm:text-2xl">
                {stageLabels[group.stage]}
              </h2>
              <span className="rounded-full bg-[color:var(--navy-light)] px-3 py-1.5 text-xs font-semibold text-[color:var(--navy)]">
                {group.clients.length}
              </span>
            </div>
            {group.clients.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-[color:var(--navy)]/15 p-6 text-center">
                <p className="text-sm text-[color:var(--ink-soft)]">No clients in this stage.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {group.clients.map((client, i) => (
                  <motion.div
                    key={client.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.15 + i * 0.03 }}
                  >
                    <Link
                      href={`/admin/client/${client.id}`}
                      className="group block rounded-xl border border-[color:var(--navy)]/10 bg-[color:var(--paper)]/50 p-4 transition-all hover:border-[color:var(--navy)]/20 hover:bg-white hover:shadow-md"
                    >
                      <p className="font-semibold text-[color:var(--navy)] group-hover:text-[color:var(--navy-soft)]">
                        {client.businessName}
                      </p>
                      <p className="mt-0.5 text-xs text-[color:var(--ink-soft)]">{client.user.name}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StageBadge stage={client.stage} />
                        <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-[color:var(--ink-soft)] shadow-sm">
                          {client._count.requests} request{client._count.requests !== 1 ? "s" : ""}
                        </span>
                        <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-[color:var(--ink-soft)] shadow-sm">
                          {client._count.documents} file{client._count.documents !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.article>
        ))}
      </section>
    </>
  );
}
