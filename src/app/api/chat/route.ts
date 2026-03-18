import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/chat - Get chat messages for a client
export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ messages: [] });

  try {
    const messages = await prisma.chatMessage.findMany({
      where: { clientId },
      orderBy: { timestamp: "asc" },
    });

    return NextResponse.json({ messages });
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

    const msg = await prisma.chatMessage.create({
      data: {
        clientId,
        senderRole: senderRole.toUpperCase() as "ADMIN" | "CLIENT",
        senderName,
        message,
        readByAdmin: senderRole === "ADMIN",
        readByClient: senderRole === "CLIENT",
      },
    });

    return NextResponse.json({ success: true, message: msg });
  } catch (error) {
    console.error("POST Chat Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
