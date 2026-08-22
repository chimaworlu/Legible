import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { userRepo } from "@/src/db/repositories/user";
import { subscriptionRepo } from "@/src/db/repositories/subscription";
import { transactionRepo } from "@/src/db/repositories/transaction";
import { intervalForAmountMinor } from "@/src/domain/billing";
import { UserMenu } from "@/src/components/dashboard/UserMenu";
import { UpgradePlanButton } from "@/src/components/dashboard/UpgradePlanButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id: string } | undefined)?.id;
  const user = userId ? await userRepo.findById(userId) : null;

  const [subscription, transactions] = userId
    ? await Promise.all([subscriptionRepo.findByUserId(userId), transactionRepo.listForUser(userId)])
    : [null, []];
  const latestCharge = transactions.find((transaction) => transaction.type === "SUBSCRIPTION_CHARGE") ?? null;
  const currentInterval = latestCharge?.amountMinor != null ? intervalForAmountMinor(latestCharge.amountMinor) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header style={{ padding: "var(--spacing-collection-base-spacing)", borderBottom: "0.0625rem solid var(--color-roles-surface-variant)" }}>
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "75rem", margin: "0 auto", width: "100%" }}>
          <strong>Legible</strong>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-collection-base-spacing)" }}>
            <UpgradePlanButton
              plan={user?.plan ?? "FREE"}
              currentInterval={currentInterval}
              currentPeriodEnd={subscription?.currentPeriodEnd ?? null}
            />
            <UserMenu
              name={session?.user?.name || session?.user?.email || "Account"}
              email={session?.user?.email || ""}
              plan={user?.plan ?? "FREE"}
              subscription={subscription}
              transactions={transactions}
              currentInterval={currentInterval}
            />
          </div>
        </nav>
      </header>
      <main style={{ flex: 1, padding: "var(--spacing-collection-large-spacing)", paddingTop: "var(--spacing-collection-screen-margin)", maxWidth: "75rem", margin: "0 auto", width: "100%" }}>
        {children}
      </main>
    </div>
  );
}
