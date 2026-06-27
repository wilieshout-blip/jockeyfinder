// lib/email.ts
// Sends transactional email via Resend.
// Errors are logged but never re-thrown so email failures never break callers.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://jockeyfinder.com";
// Default to Resend's shared sender so admin emails work before the domain is
// verified (it can only deliver to the Resend account owner's address, which is
// fine for admin notifications). Once jockeyfinder.com is verified in Resend,
// set EMAIL_FROM="JockeyFinder <noreply@jockeyfinder.com>" in Vercel to send to
// everyone — no code change needed.
const FROM = process.env.EMAIL_FROM ?? "JockeyFinder <onboarding@resend.dev>";

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
      body: JSON.stringify({ from: FROM, to: [to.trim().toLowerCase()], subject, html }),
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

function emailLayout(body: string, preheader = "") {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JockeyFinder</title></head><body style="margin:0;padding:0;background:#0b3d2e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>` : ""}
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0b3d2e;padding:32px 16px">
  <tr><td align="center">
    <table width="100%" role="presentation" style="max-width:560px">
      <tr><td style="padding:8px 4px 18px">
        <span style="font-size:22px;font-weight:800;letter-spacing:-.5px;color:#ffffff">JOCKEY</span><span style="font-size:22px;font-weight:800;letter-spacing:-.5px;color:#34d399">FINDER</span>
      </td></tr>
      <tr><td style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.18)">
        <table width="100%" role="presentation">
          <tr><td style="height:4px;background:#16a34a"></td></tr>
          <tr><td style="padding:32px 36px">${body}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 8px 0">
        <p style="margin:0 0 4px;font-size:12px;color:#a7c3b6">
          <a href="${SITE_URL}" style="color:#a7c3b6;text-decoration:none">jockeyfinder.com</a>
          &nbsp;·&nbsp; Plan rides. Book jockeys.
        </p>
        <p style="margin:0;font-size:11px;color:#6f9384">
          You're receiving this because you have a JockeyFinder account.
          Questions? <a href="mailto:Wilieshout@gmail.com" style="color:#6f9384">contact us</a>.
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

/** Escape user-supplied text before embedding it in email HTML. */
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

/** Email a chat participant when they receive a new message. */
export async function emailNewMessage(opts: {
  to: string;
  senderName: string;
  preview: string;
  threadId: string;
}) {
  const preview =
    opts.preview.length > 140 ? opts.preview.slice(0, 140).trim() + "…" : opts.preview;
  return sendEmail(
    opts.to,
    `New message from ${opts.senderName}`,
    emailLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">New message 💬</h2>
      <p style="margin:0 0 14px;font-size:15px;color:#374151">
        <strong>${escapeHtml(opts.senderName)}</strong> sent you a message on JockeyFinder:
      </p>
      <blockquote style="margin:0;padding:12px 16px;border-left:3px solid #16a34a;background:#f0fdf4;border-radius:8px;font-size:15px;color:#374151">
        ${escapeHtml(preview)}
      </blockquote>
      ${cta("Open the conversation →", `${SITE_URL}/dashboard/messages/${opts.threadId}`)}
      <p style="margin:18px 0 0;font-size:12px;color:#9ca3af">
        You can turn message emails off under Notifications in your profile settings.
      </p>
    `)
  );
}

/** Send an admin-authored broadcast email (subject + HTML body) to one address.
 * The body is wrapped in the standard branded layout. */
export async function sendBroadcastEmail(to: string, subject: string, bodyHtml: string) {
  return sendEmail(to, subject, emailLayout(bodyHtml));
}

/** Email a syndicate member when their manager posts an update. */
export async function emailSyndicateUpdate(opts: {
  to: string;
  firstName: string;
  groupName: string;
  body: string;
}) {
  return sendEmail(
    opts.to,
    `Update from ${opts.groupName}`,
    emailLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">${escapeHtml(opts.groupName)}</h2>
      <p style="margin:0 0 14px;font-size:15px;color:#374151">Hi ${escapeHtml(opts.firstName)}, your syndicate manager posted an update:</p>
      <blockquote style="margin:0;padding:12px 16px;border-left:3px solid #16a34a;background:#f0fdf4;border-radius:8px;font-size:15px;color:#374151;white-space:pre-wrap">${escapeHtml(opts.body)}</blockquote>
      ${cta("Open JockeyFinder →", `${SITE_URL}/dashboard`)}
    `)
  );
}

/** Notify an owner / syndicate micro-owner when a jockey is assigned to their horse. */
export async function emailOwnerStaking(opts: {
  to: string;
  firstName: string;
  jockeyName: string;
  horseName: string;
  track?: string | null;
  meetingDate?: string | null;
}) {
  const where = [opts.track, opts.meetingDate].filter(Boolean).join(" · ");
  return sendEmail(
    opts.to,
    `${opts.jockeyName} is booked on ${opts.horseName}`,
    emailLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">Jockey booked 🏇</h2>
      <p style="margin:0;font-size:15px;color:#374151">
        Hi ${escapeHtml(opts.firstName)}, <strong>${escapeHtml(opts.jockeyName)}</strong> has been assigned to ride
        <strong>${escapeHtml(opts.horseName)}</strong>${where ? ` at <strong>${escapeHtml(where)}</strong>` : ""}.
      </p>
      ${cta("View on JockeyFinder →", `${SITE_URL}/dashboard`)}
    `)
  );
}

/** Notify the site admin when a new user signs up. */
export async function emailNewSignup(opts: {
  name?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  test?: boolean;
}) {
  const to = process.env.ADMIN_EMAIL;
  if (!to) {
    console.warn("[email] ADMIN_EMAIL not configured; skipping new-signup notice");
    return false;
  }
  const name = opts.name || "Unnamed user";
  const role = opts.role || "unknown";
  const rows = [
    ["Name", name],
    ["Role", role],
    ["Email", opts.email || "—"],
    ["Phone", opts.phone || "—"],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:90px">${k}</td><td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600">${v}</td></tr>`
    )
    .join("");
  return sendEmail(
    to,
    `${opts.test ? "[TEST] " : ""}New ${role} signup: ${name}`,
    emailLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">New signup${opts.test ? " (test)" : ""} 🎉</h2>
      <p style="margin:0 0 16px;font-size:15px;color:#374151">
        A new ${role} just created an account on JockeyFinder.${opts.test ? " <em>This is a test email.</em>" : ""}
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin:8px 0">${rows}</table>
      ${cta("Review in admin →", `${SITE_URL}/admin/users`)}
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
