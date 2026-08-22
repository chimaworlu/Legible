import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "../[...nextauth]/route";
import { prisma } from "@/src/db/client";
import { verificationCodeRepo } from "@/src/db/repositories/verificationCode";
import { verifyCodeHash, MAX_VERIFICATION_ATTEMPTS } from "@/src/auth/verificationCode";

const verifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const result = verifySchema.safeParse(body);
  if (!result.success) {
    return Response.json({ message: result.error.issues[0].message }, { status: 400 });
  }

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.emailVerified) {
    return Response.json({ message: "Email already verified", emailVerified: true });
  }

  const active = await verificationCodeRepo.findActiveByUser(userId);
  if (!active) {
    return Response.json({ message: "Code expired or not found. Request a new one." }, { status: 400 });
  }
  if (active.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    await verificationCodeRepo.consume(active.id);
    return Response.json({ message: "Too many attempts. Request a new code." }, { status: 400 });
  }

  if (!verifyCodeHash(result.data.code, active.codeHash)) {
    const updated = await verificationCodeRepo.incrementAttempts(active.id);
    if (updated.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      await verificationCodeRepo.consume(active.id);
      return Response.json({ message: "Too many attempts. Request a new code." }, { status: 400 });
    }
    return Response.json({ message: "Invalid code" }, { status: 400 });
  }

  // The code's job ends the moment it's verified — delete it rather than
  // just marking it consumed, so no verification-code material lingers in
  // the database once it's served its purpose.
  await verificationCodeRepo.delete(active.id);
  await prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });

  return Response.json({ message: "Email verified", emailVerified: true });
}
