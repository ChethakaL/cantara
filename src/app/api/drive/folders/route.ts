import { NextRequest, NextResponse } from "next/server";
import { executeGoogleDriveTool } from "@/lib/composio";

function driveQueryString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function extractFolders(result: any) {
  const files = result?.files ?? result?.data?.files ?? result?.response_data?.files ?? [];
  if (!Array.isArray(files)) return [];
  return files
    .filter((file) => file?.id && file?.trashed !== true)
    .map((file) => ({
      id: file.id,
      name: file.name || "Untitled folder",
      url: `https://drive.google.com/drive/folders/${file.id}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET(req: NextRequest) {
  const parentId = req.nextUrl.searchParams.get("parentId")?.trim() || "root";
  const q = [
    "mimeType = 'application/vnd.google-apps.folder'",
    `'${driveQueryString(parentId)}' in parents`,
    "trashed = false",
  ].join(" and ");

  try {
    const result = await executeGoogleDriveTool<any>("GOOGLEDRIVE_FIND_FILE", {
      q,
      fields: "files(id, name, trashed)",
    });

    if (result.successful === false) {
      const detail = typeof result.error === "string" ? result.error : JSON.stringify(result.error ?? result.data);
      return NextResponse.json({ error: detail || "Could not list Google Drive folders" }, { status: 409 });
    }

    return NextResponse.json({
      parentId,
      folders: extractFolders(result.data ?? result),
    });
  } catch (error) {
    console.error("Drive folder list error:", error);
    return NextResponse.json({ error: "Google Drive is not connected or folders could not be listed" }, { status: 409 });
  }
}
