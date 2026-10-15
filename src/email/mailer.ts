import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;
let fallbackTransporter: Transporter | null = null;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function requireSmtpEnv() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP configuration is missing required environment variables");
  }
  return { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS };
}

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = requireSmtpEnv();

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // Force IPv4 resolution at the socket level to dodge IPv6-routing dead
    // ends some hosts hit against SMTP providers.
    family: 4,
  });

  return transporter;
}

// Falls back to port 465 (implicit TLS) if the configured port (normally
// 587/STARTTLS) can't connect — a different failure mode than auth/content
// errors, so only a connection-stage error should trigger it.
function getFallbackTransporter(): Transporter {
  if (fallbackTransporter) return fallbackTransporter;

  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = requireSmtpEnv();

  fallbackTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: 465,
    secure: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    family: 4,
  });

  return fallbackTransporter;
}

function isConnectionError(err: unknown): boolean {
  const code = (err as { code?: string } | undefined)?.code;
  return code === "ESOCKET" || code === "ETIMEDOUT" || code === "ECONNECTION" || code === "ECONNREFUSED";
}

async function sendMail(message: Parameters<Transporter["sendMail"]>[0]): Promise<void> {
  try {
    await getTransporter().sendMail(message);
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    await getFallbackTransporter().sendMail(message);
  }
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  const from = process.env.EMAIL_FROM || "Legible <no-reply@legible.app>";

  await sendMail({
    from,
    to,
    subject: "Verify your email address",
    text: `Your Legible verification code is ${code}. It expires in 15 minutes.`,
    html: `<p>Your Legible verification code is:</p><p style="font-size:1.5rem;font-weight:bold;letter-spacing:0.25rem;">${code}</p><p>This code expires in 15 minutes.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  const from = process.env.EMAIL_FROM || "Legible <no-reply@legible.app>";

  await sendMail({
    from,
    to,
    subject: "Reset your Legible password",
    text: `Your Legible password reset code is ${code}. It expires in 15 minutes. If you didn't request this, you can safely ignore this email.`,
    html: `<p>Your Legible password reset code is:</p><p style="font-size:1.5rem;font-weight:bold;letter-spacing:0.25rem;">${code}</p><p>This code expires in 15 minutes.</p><p>If you didn't request this, you can safely ignore this email.</p>`,
  });
}

export async function sendManualRenewalReminderEmail(to: string, renewsByDate: string): Promise<void> {
  const from = process.env.EMAIL_FROM || "Legible <no-reply@legible.app>";

  await sendMail({
    from,
    to,
    subject: "Your Legible PRO plan is active — here's how renewal works",
    text: `Thanks for subscribing to PRO! Since you paid by transfer/USSD (rather than card), Flutterwave can't automatically charge you again next cycle — you'll need to come back and check out again before ${renewsByDate} to keep PRO active. We'll show a reminder on your dashboard as that date approaches.`,
    html: `<p>Thanks for subscribing to PRO!</p><p>Since you paid by transfer/USSD (rather than card), Flutterwave can't automatically charge you again next cycle — you'll need to come back and check out again before <strong>${renewsByDate}</strong> to keep PRO active.</p><p>We'll show a reminder on your dashboard as that date approaches.</p>`,
  });
}

export async function sendContactMessageEmail(fields: { name: string; email: string; message: string }): Promise<void> {
  const from = process.env.EMAIL_FROM || "Legible <no-reply@legible.app>";
  const to = process.env.CONTACT_EMAIL_TO || "legible.team@gmail.com";
  const { name, email, message } = fields;

  await sendMail({
    from,
    to,
    replyTo: email,
    subject: `New contact message from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    html: `<p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Message:</strong></p><p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`,
  });
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const from = process.env.EMAIL_FROM || "Legible <no-reply@legible.app>";
  const discordUrl = process.env.DISCORD_INVITE_URL || "https://discord.gg/REPLACE_ME";

  await sendMail({
    from,
    to,
    subject: "Welcome to Legible! 🎉 Join our student community on Discord",
    text: `Hi ${name},\n\nWelcome to Legible — you're all set! From here you can start turning photos of your handwritten notes into clean, structured digital books.\n\nWhile you get started, come join our Discord community, where other students hang out, share tips, and get help from the team:\n\n${discordUrl}\n\nSee you there!\n— The Legible Team`,
    html: `<p>Hi ${name},</p><p>Welcome to Legible — you're all set! From here you can start turning photos of your handwritten notes into clean, structured digital books.</p><p>While you get started, come join our Discord community, where other students hang out, share tips, and get help from the team:</p><p><a href="${discordUrl}">👉 Join our Discord</a></p><p>See you there!<br/>— The Legible Team</p>`,
  });
}
