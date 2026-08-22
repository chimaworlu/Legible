import { getServerSession } from "next-auth";
import { authOptions } from "../[...nextauth]/route";
import { prisma } from "@/src/db/client";
import { verificationCodeRepo } from "@/src/db/repositories/verificationCode";
import { issueVerificationCode } from "@/src/auth/issueVerificationCode";

const RESEND_COOLDOWN_MS = 60 * 1000;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.emailVerified) {
    return Response.json({ message: "Email already verified", emailVerified: true });
  }

  const latest = await verificationCodeRepo.findLatestByUser(userId);
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - latest.createdAt.getTime())) / 1000);
    return Response.json({ message: `Please wait ${waitSeconds}s before requesting another code.` }, { status: 429 });
  }

  try {
    await issueVerificationCode(user.id, user.email);
  } catch (err) {
    console.error("Failed to send verification email", { userId: user.id, error: err instanceof Error ? err.message : err });
    return Response.json({ message: "Failed to send verification email. Try again shortly." }, { status: 500 });
  }

  return Response.json({ message: "Verification code sent" });
}
