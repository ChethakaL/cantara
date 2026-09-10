import { NextRequest, NextResponse } from "next/server";
import { executeGoogleDriveTool } from "@/lib/composio";

function driveQueryString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

type DriveFolderRow = {
  id: string;
  name: string;
  url: string;
  source?: "myDrive" | "shared" | "sharedDrive";
};

function extractFolders(result: any, source?: DriveFolderRow["source"]): DriveFolderRow[] {
  const files = result?.files ?? result?.data?.files ?? result?.response_data?.files ?? [];
  if (!Array.isArray(files)) return [];
  return files
    .filter((file) => file?.id && file?.trashed !== true)
    .map((file) => ({
      id: String(file.id),
      name: String(file.name || "Untitled folder"),
      url: `https://drive.google.com/drive/folders/${file.id}`,
      ...(source ? { source } : {}),
    }));
}

function extractSharedDrives(result: any): DriveFolderRow[] {
  const drives =
    result?.drives ??
    result?.data?.drives ??
    result?.response_data?.drives ??
    result?.items ??
    result?.data?.items ??
    [];
  if (!Array.isArray(drives)) return [];
  return drives
    .filter((drive) => drive?.id)
    .map((drive) => ({
      id: String(drive.id),
      name: String(drive.name || "Shared drive"),
      url: `https://drive.google.com/drive/folders/${drive.id}`,
      source: "sharedDrive" as const,
    }));
}

async function findFolders(q: string, opts?: { corpora?: string }) {
  const base = {
    q,
    fields: "files(id, name, trashed, shared, driveId)",
    pageSize: 100,
  };

  const withDriveSupport = await executeGoogleDriveTool<any>("GOOGLEDRIVE_FIND_FILE", {
    ...base,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(opts?.corpora ? { corpora: opts.corpora } : {}),
  }).catch(() => null);

  if (withDriveSupport && withDriveSupport.successful !== false) {
    return withDriveSupport;
  }

  // Fallback for Composio setups that reject the extra Drive flags.
  return executeGoogleDriveTool<any>("GOOGLEDRIVE_FIND_FILE", base);
}

function mergeFolders(...groups: DriveFolderRow[][]) {
  const byId = new Map<string, DriveFolderRow>();
  for (const group of groups) {
    for (const folder of group) {
      if (!byId.has(folder.id)) byId.set(folder.id, folder);
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const sourceRank = (source?: DriveFolderRow["source"]) => {
      if (source === "myDrive") return 0;
      if (source === "sharedDrive") return 1;
      if (source === "shared") return 2;
      return 3;
    };
    const rankDiff = sourceRank(a.source) - sourceRank(b.source);
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });
}

export async function GET(req: NextRequest) {
  const parentId = req.nextUrl.searchParams.get("parentId")?.trim() || "root";

  try {
    if (parentId === "root") {
      const [mineResult, sharedResult, drivesResult] = await Promise.all([
        findFolders(
          [
            "mimeType = 'application/vnd.google-apps.folder'",
            "'root' in parents",
            "trashed = false",
          ].join(" and "),
        ),
        findFolders(
          [
            "mimeType = 'application/vnd.google-apps.folder'",
            "sharedWithMe = true",
            "trashed = false",
          ].join(" and "),
        ),
        // Best-effort: some Composio setups expose shared-drive listing under this slug.
        executeGoogleDriveTool<any>("GOOGLEDRIVE_LIST_SHARED_DRIVES", {
          pageSize: 100,
        }).catch(() => null),
      ]);

      if (mineResult.successful === false && sharedResult.successful === false) {
        const detail =
          (typeof mineResult.error === "string" && mineResult.error) ||
          (typeof sharedResult.error === "string" && sharedResult.error) ||
          "Could not list Google Drive folders";
        return NextResponse.json({ error: detail }, { status: 409 });
      }

      const mine = mineResult.successful === false ? [] : extractFolders(mineResult.data ?? mineResult, "myDrive");
      const shared = sharedResult.successful === false ? [] : extractFolders(sharedResult.data ?? sharedResult, "shared");
      const sharedDrives =
        drivesResult && drivesResult.successful !== false
          ? extractSharedDrives(drivesResult.data ?? drivesResult)
          : [];

      return NextResponse.json({
        parentId,
        folders: mergeFolders(mine, sharedDrives, shared),
      });
    }

    const q = [
      "mimeType = 'application/vnd.google-apps.folder'",
      `'${driveQueryString(parentId)}' in parents`,
      "trashed = false",
    ].join(" and ");

    const result = await findFolders(q, { corpora: "allDrives" });

    if (result.successful === false) {
      const detail = typeof result.error === "string" ? result.error : JSON.stringify(result.error ?? result.data);
      return NextResponse.json({ error: detail || "Could not list Google Drive folders" }, { status: 409 });
    }

    return NextResponse.json({
      parentId,
      folders: mergeFolders(extractFolders(result.data ?? result)),
    });
  } catch (error) {
    console.error("Drive folder list error:", error);
    return NextResponse.json({ error: "Google Drive is not connected or folders could not be listed" }, { status: 409 });
  }
}
