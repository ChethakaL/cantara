import { NextRequest, NextResponse } from "next/server";
import { createQuickBooksConnectLink } from "@/lib/composio";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { clientId } = await req.json();
    if (!clientId || typeof clientId !== "string") {
      return new Response("clientId is required", { status: 400 });
    }

    const client = await prisma.clientProfile.findUnique({ where: { id: clientId } });
    if (!client) return new Response("Client not found", { status: 404 });

    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    const link = await createQuickBooksConnectLink({
      clientId,
      callbackUrl: `${origin}/dashboard?quickbooks=connected`,
    });

    return NextResponse.json(link);
  } catch (error) {
    console.error("QuickBooks connect link error:", error);
    return new Response("Failed to create QuickBooks connect link", { status: 500 });
  }
}
