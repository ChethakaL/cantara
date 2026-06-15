import { NextRequest, NextResponse } from "next/server";
import { getDriveParentFolder, saveDriveParentFolder } from "@/lib/drive-settings";

export async function GET() {
  try {
    return NextResponse.json({ parentFolder: await getDriveParentFolder() });
  } catch (error) {
    console.error("Drive settings load error:", error);
    return NextResponse.json({ error: "Failed to load Google Drive settings" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parentFolder = typeof body.parentFolder === "string" ? body.parentFolder : "";
    return NextResponse.json({ parentFolder: await saveDriveParentFolder(parentFolder) });
  } catch (error) {
    console.error("Drive settings save error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save Google Drive settings" }, { status: 400 });
  }
}
