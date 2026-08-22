import { getServerSession } from "next-auth";
import { authOptions } from "../[...nextauth]/route";
import { prisma } from "@/src/db/client";

export async function POST() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  // PRD R29: Delete account and all associated data.
  // Prisma schema handles cascades automatically.
  await prisma.user.delete({
    where: { id: (session.user as { id: string }).id }
  });

  return Response.json({ message: "Account deleted successfully" });
}
