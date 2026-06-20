// lib/email.ts
// Sends transactional email via Resend.
// Errors are logged but never re-thrown so email failures never break callers.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://jockeyfinder.com";
const FROM = "JockeyFinder <noreply@jockeyfinder.com>";

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    // No key configured — skip silently in dev
    console.warn("[email] RESEND_API_KEY is not configured");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    if (!res.ok) {
      console.error("[email] Resend error:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] sendEmail failed:", err);
    return false;
  }
}

// ── Layout & helpers ─────────────────────────────────────────────────────────

function emailLayout(body: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JockeyFinder</title></head><body style="margin:0;padding:0;background:#f4f6f5;font-family:system-ui,-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
  <tr><td align="center">
    <table width="100%" style="max-width:540px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06)">
      <tr><td style="background:#16a34a;padding:24px 32px">
        <span style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-.5px">🏇 JockeyFinder</span>
      </td></tr>
      <tr><td style="padding:32px">${body}</td></tr>
      <tr><td style="padding:16px 32px 28px;border-top:1px solid #e5e7eb">
        <p style="margin:0;font-size:12px;color:#6b7280">
          You received this because you are a JockeyFinder member.&nbsp;
          <a href="${SITE_URL}/dashboard" style="color:#16a34a">Go to dashboard →</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function cta(label: string, href: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;background:#16a34a;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:10px 22px;border-radius:99px">${label}</a>`;
}

function detail(
  horseName?: string | null,
  track?: string | null,
  meetingDate?: string | null
) {
  return [horseName, track, meetingDate].filter(Boolean).join(" · ");
}

// ── Exported email helpers ───────────────────────────────────────────────────

/** Email the counterpart when a new ride request is created. */
export async function emailNewRequest(opts: {
  to: string;
  senderName: string;
  horseName?: string | null;
  track?: string | null;
  meetingDate?: string | null;
}) {
  const d = detail(opts.horseName, opts.track, opts.meetingDate);
  await sendEmail(
    opts.to,
    "New ride request on JockeyFinder",
    emailLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">New ride request</h2>
      <p style="margin:0;font-size:15px;color:#374151">
        <strong>${opts.senderName}</strong> has sent you a ride request${d ? ` for <strong>${d}</strong>` : ""}.
        Log in to accept or decline.
      </p>
      ${cta("View request →", `${SITE_URL}/dashboard/requests`)}
    `)
  );
}

/** Email the trainer when a jockey accepts their request. */
export async function emailRequestAccepted(opts: {
  to: string;
  jockeyName: string;
  horseName?: string | null;
  track?: string | null;
  meetingDate?: string | null;
}) {
  const d = detail(opts.horseName, opts.track, opts.meetingDate);
  await sendEmail(
    opts.to,
    `${opts.jockeyName} accepted your ride request`,
    emailLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">Request accepted 🎉</h2>
      <p style="margin:0;font-size:15px;color:#374151">
        <strong>${opts.jockeyName}</strong> has accepted your ride request${d ? ` for <strong>${d}</strong>` : ""}.
        You can now assign the ride to confirm it.
      </p>
      ${cta("Assign the ride →", `${SITE_URL}/dashboard/requests`)}
    `)
  );
}

/** Email the request creator when a jockey declines. */
export async function emailRequestDeclined(opts: {
  to: string;
  jockeyName: string;
  horseName?: string | null;
  track?: string | null;
  meetingDate?: string | null;
}) {
  const d = detail(opts.horseName, opts.track, opts.meetingDate);
  await sendEmail(
    opts.to,
    "Your ride request was declined",
    emailLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">Request declined</h2>
      <p style="margin:0;font-size:15px;color:#374151">
        <strong>${opts.jockeyName}</strong> has declined your ride request${d ? ` for <strong>${d}</strong>` : ""}.
        You can send a new request to another jockey.
      </p>
      ${cta("Find another jockey →", `${SITE_URL}/jockeys`)}
    `)
  );
}

/** Email the jockey when a trainer assigns the ride (confirms it). */
export async function emailRideAssigned(opts: {
  to: string;
  trainerName: string;
  horseName?: string | null;
  track?: string | null;
  meetingDate?: string | null;
}) {
  const d = detail(opts.horseName, opts.track, opts.meetingDate);
  await sendEmail(
    opts.to,
    `Ride confirmed${opts.horseName ? ` — ${opts.horseName}` : ""}`,
    emailLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">Ride confirmed ✅</h2>
      <p style="margin:0;font-size:15px;color:#374151">
        <strong>${opts.trainerName}</strong> has confirmed your ride${d ? ` for <strong>${d}</strong>` : ""}.
        Check the chat thread for gear, transport, and race day plans.
      </p>
      ${cta("Open messages →", `${SITE_URL}/dashboard/messages`)}
    `)
  );
}

export async function emailTrialReminder({
  to, firstName, role, daysLeft, trialEndDate,
}: {
  to: string;
  firstName: string;
  role: string;
  daysLeft: number;
  trialEndDate: Date;
}) {
  const prices: Record<string, string> = {
    jockey: "$12.99 NZD/week",
    trainer: "$4.99 NZD/week",
    owner: "$1.99 NZD/week",
  };
  const price = prices[role] || "";
  const planName = role.charAt(0).toUpperCase() + role.slice(1);
  const dateStr = trialEndDate.toLocaleDateString("en-NZ", {
    day: "numeric", month: "long", year: "numeric",
  });
  const html = emailLayout(`
    <h2 style="margin:0 0 16px">Your free trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}</h2>
    <p>Hi ${firstName},</p>
    <p>Your JockeyFinder free trial ends on <strong>${dateStr}</strong>.</p>
    <p>After that, your ${planName} plan is <strong>${price}</strong>.</p>
    <p>Add a card now to keep your access uninterrupted.</p>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing"
       style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">
      Manage Billing
    </a>
    <p style="color:#6b7280;font-size:14px;margin-top:24px">You can cancel anytime from your billing settings.</p>
  `);
  return sendEmail(
    to,
    `Your JockeyFinder trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
    html
  );
}
