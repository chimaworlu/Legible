import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { userRepo } from "@/src/db/repositories/user";
import { subscriptionRepo } from "@/src/db/repositories/subscription";
import { expireManualSubscriptionIfDue } from "@/src/services/billing/reconcile";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  // Lazy expiry check — see expireManualSubscriptionIfDue for why this has
  // to happen here rather than on a schedule.
  await expireManualSubscriptionIfDue(userId);

  const [user, subscription] = await Promise.all([userRepo.findById(userId), subscriptionRepo.findByUserId(userId)]);
  if (!user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    plan: user.plan,
    subscription: subscription
      ? { status: subscription.status, renewalMode: subscription.renewalMode, currentPeriodEnd: subscription.currentPeriodEnd }
      : null,
  });
}
