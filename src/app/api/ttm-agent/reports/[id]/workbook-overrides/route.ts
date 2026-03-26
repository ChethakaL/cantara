import { NextRequest, NextResponse } from "next/server";
import {
  applyWorkbookOverrides,
  previewWorkbookOverrides,
  TtmOrchestratorError,
} from "@/lib/ttm-agent/orchestrator";
import type { WorkbookOverrideSnapshot } from "@/lib/ttm-agent/workbook-overrides";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return new Response("file is required", { status: 400 });
      }
      const arrayBuffer = await file.arrayBuffer();
      const result = await previewWorkbookOverrides({
        analysisId: params.id,
        workbookBuffer: Buffer.from(arrayBuffer),
      });
      return NextResponse.json(result);
    }

    const body = (await req.json()) as {
      snapshot?: WorkbookOverrideSnapshot;
    };
    if (!body?.snapshot) {
      return new Response("snapshot is required", { status: 400 });
    }
    const updated = await applyWorkbookOverrides({
      analysisId: params.id,
      snapshot: body.snapshot,
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TtmOrchestratorError) {
      return new Response(error.message, { status: error.statusCode });
    }
    console.error("Workbook override route error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
