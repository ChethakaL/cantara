import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishChatUpdate } from "@/lib/chat-bus";
import { mapChatMessage, normalizeSenderRole } from "@/lib/chat-utils";

export const dynamic = "force-dynamic";

// GET /api/chat - Get chat messages for a client
export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ messages: [] });

  try {
    const messages = await prisma.chatMessage.findMany({
      where: { clientId },
      orderBy: { timestamp: "asc" },
    });

    return NextResponse.json({
      messages: messages.map(mapChatMessage),
    });
  } catch (error) {
    console.error("GET Chat Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// POST /api/chat - Save a new chat message
export async function POST(req: NextRequest) {
  try {
    const { clientId, senderRole, senderName, message } = await req.json();

    if (!clientId || !message) {
      return new Response("Missing required fields", { status: 400 });
    }

    const role = normalizeSenderRole(String(senderRole || "client"));
    const msg = await prisma.chatMessage.create({
      data: {
        clientId,
        senderRole: role === "admin" ? "ADMIN" : "CLIENT",
        senderName,
        message,
        readByAdmin: role === "admin",
        readByClient: role === "client",
      },
    });

    publishChatUpdate(clientId);

    return NextResponse.json({ success: true, message: mapChatMessage(msg) });
  } catch (error) {
    console.error("POST Chat Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
