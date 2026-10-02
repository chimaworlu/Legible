import { z } from "zod";
import { sendContactMessageEmail } from "@/src/email/mailer";
import { checkRateLimit, extractClientIp, rateLimitedResponse } from "@/src/services/rateLimit";
import { config } from "@/src/config";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email(),
  message: z.string().trim().min(1, "Message is required").max(5000),
});

export async function POST(req: Request) {
  const ip = extractClientIp(req.headers);
  const rateLimit = await checkRateLimit(`contact:ip:${ip}`, config.rateLimits.contactPerIp);
  if (!rateLimit.allowed) {
    return rateLimitedResponse("Too many messages sent from this network. Please try again later.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const result = contactSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ message: result.error.issues[0].message }, { status: 400 });
  }

  try {
    await sendContactMessageEmail(result.data);
  } catch (err) {
    console.error("Failed to send contact message email", { error: err instanceof Error ? err.message : err });
    return Response.json({ message: "Could not send your message. Please try again." }, { status: 500 });
  }

  return Response.json({ message: "Success" }, { status: 200 });
}
