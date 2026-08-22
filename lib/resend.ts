import "server-only";

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_ADDRESS = "alerts@thaigoldtracker.com";

export class EmailSendError extends Error {}

export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new EmailSendError("Missing RESEND_API_KEY environment variable");
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  });

  if (!response.ok) {
    const bodySnippet = (await response.text().catch(() => "")).slice(0, 300);
    throw new EmailSendError(`Resend API returned HTTP ${response.status}: ${bodySnippet}`);
  }
}
