import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { reconcileTransaction } from "@/src/services/billing/reconcile";

// Flutterwave's v3 Standard checkout appends ?status=&tx_ref=&transaction_id=
// to redirect_url (developer.flutterwave.com/v3.0.0/docs/flutterwave-standard-1).
//
// This route independently re-verifies and grants via reconcileTransaction —
// a verified server-side confirmation call, which security.md rule 7
// explicitly allows as an alternative to a webhook. That matters here: a
// webhook is only reachable if one is actually registered with a public URL
// in the Flutterwave dashboard, which local dev usually isn't. This path is
// what the customer's own browser hits regardless, so it acts as backup
// polling for exactly the case where no webhook ever arrives. Idempotent by
// tx_ref, so it's safe for both this and the webhook to fire for the same
// payment.
export async function GET(req: Request) {
  const url = new URL(req.url);

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.redirect(new URL("/auth", url.origin), 307);
  }

  const transactionId = url.searchParams.get("transaction_id");

  let outcome: "success" | "pending" | "unknown" = "unknown";
  if (transactionId) {
    try {
      const result = await reconcileTransaction(transactionId, "CALLBACK");
      outcome = result.status === "granted" || result.status === "already_processed" ? "success" : "pending";
      if (result.status === "verification_mismatch" || result.status === "unknown_tx_ref" || result.status === "user_not_found") {
        console.error("Flutterwave callback could not reconcile transaction", result);
      }
    } catch (error) {
      console.error("Failed to verify Flutterwave transaction on callback", { transactionId, error: error instanceof Error ? error.message : error });
    }
  }

  return Response.redirect(new URL(`/dashboard?upgrade=${outcome}`, url.origin), 307);
}
