import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const clients = await prisma.clientProfile.findMany({
      select: {
        id: true,
        businessName: true,
      },
      orderBy: { businessName: "asc" },
    });

    return new Response(JSON.stringify(clients), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to fetch clients:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
