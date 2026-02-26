"use client";

import { Check, ChevronDown, FolderClosed, HardDrive, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { sileo } from "sileo";

type DriveFolder = {
  id: string;
  name: string;
};

const ROOT_FOLDER_OPTION: DriveFolder = { id: "root", name: "My Drive" };

type GoogleDriveConfigProps = {
  isConnected: boolean;
  selectedFolderId: string | null;
  selectedFolderName: string | null;
  folders: DriveFolder[];
  loadError?: string | null;
};

export function GoogleDriveConfig({
  isConnected,
  selectedFolderId,
  selectedFolderName,
  folders,
  loadError,
}: GoogleDriveConfigProps) {
  const router = useRouter();
  const allFolders = useMemo(() => [ROOT_FOLDER_OPTION, ...folders], [folders]);

  const [folderId, setFolderId] = useState(selectedFolderId ?? "root");
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!dropdownRef.current) {
        return;
      }

      if (!dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const visibleFolders = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      return allFolders;
    }

    return allFolders.filter((folder) => folder.name.toLowerCase().includes(q));
  }, [allFolders, query]);

  const selected = allFolders.find((folder) => folder.id === folderId) ?? ROOT_FOLDER_OPTION;

  async function saveLocation() {
    setIsSaving(true);

    const response = await fetch("/api/admin/google-drive/location", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ folderId }),
    });

    const payload = (await response.json()) as { error?: string; folderName?: string };

    if (!response.ok) {
      sileo.error({
        title: "Could not save location",
        description: payload.error ?? "Unable to save folder location",
      });
      setIsSaving(false);
      return;
    }

    sileo.success({
      title: "Drive location updated",
      description: `New parent folder: ${payload.folderName ?? "Selected folder"}`,
    });
    setIsSaving(false);
    setIsOpen(false);
    router.refresh();
  }

  if (!isConnected) {
    return (
      <article className="fin-card mb-6 rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-[color:var(--navy)]">Google Drive</h2>
            <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
              Connect once, then select where each client folder should be created.
            </p>
          </div>
          <HardDrive className="animate-float text-[color:var(--navy-soft)]" size={24} />
        </div>

        <div className="mt-5">
          <a
            href="/api/admin/google-drive/connect"
            className="inline-flex rounded-xl bg-[color:var(--navy)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--navy-soft)]"
          >
            Connect Google Drive
          </a>
        </div>
      </article>
    );
  }

  return (
    <article className="fin-card relative z-30 mb-6 overflow-visible rounded-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl text-[color:var(--navy)]">Google Drive Location</h2>
          <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
            Choose the parent folder. New client folders are created inside this location.
          </p>
        </div>
        <a
          href="/api/admin/google-drive/connect"
          className="rounded-lg border border-[color:var(--navy)]/20 px-3 py-1 text-xs font-semibold text-[color:var(--navy)] transition hover:bg-white"
        >
          Reconnect
        </a>
      </div>

      {selectedFolderName ? (
        <p className="mt-3 text-xs font-semibold tracking-[0.12em] text-[color:var(--ink-soft)] uppercase">
          Current: {selectedFolderName}
        </p>
      ) : null}

      {loadError ? (
        <p className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {loadError}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-[2fr_auto]">
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            className="flex w-full items-center justify-between rounded-xl border border-[color:var(--navy)]/20 bg-white px-3 py-2 text-left text-sm text-[color:var(--navy)] transition hover:border-[color:var(--navy)]/45"
          >
            <span className="flex items-center gap-2">
              <FolderClosed size={16} className="text-[color:var(--navy-soft)]" />
              {selected.name}
            </span>
            <ChevronDown size={16} className={`transition ${isOpen ? "rotate-180" : ""}`} />
          </button>

          {isOpen ? (
            <div className="animate-rise relative z-40 mt-2 w-full rounded-2xl border border-[color:var(--navy)]/20 bg-white p-3 shadow-[0_25px_50px_-24px_rgba(13,35,58,0.45)]">
              <div className="relative mb-3">
                <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--ink-soft)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search folders"
                  className="w-full rounded-lg border border-[color:var(--navy)]/15 bg-slate-50 py-2 pr-3 pl-8 text-sm outline-none ring-[color:var(--navy)] transition focus:ring"
                />
              </div>

              <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {visibleFolders.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[color:var(--navy)]/20 px-3 py-2 text-xs text-[color:var(--ink-soft)]">
                    No matching folders found.
                  </p>
                ) : (
                  visibleFolders.map((folder) => {
                    const active = folder.id === folderId;
                    return (
                      <button
                        type="button"
                        key={folder.id}
                        onClick={() => {
                          setFolderId(folder.id);
                          setQuery("");
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                          active
                            ? "bg-[color:var(--navy)] text-white"
                            : "text-[color:var(--navy)] hover:bg-[color:var(--paper-soft)]"
                        }`}
                      >
                        <span className="truncate">{folder.name}</span>
                        {active ? <Check size={14} /> : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => void saveLocation()}
          disabled={isSaving}
          className="rounded-xl bg-[color:var(--navy)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--navy-soft)] disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save location"}
        </button>
      </div>
    </article>
  );
}
