// lib/sms.ts
// SMS via the Twilio REST API, env-gated. Returns false (no-op) when the
// TWILIO_* env vars aren't set, so callers stay safe until a provider is
// configured — mirrors how the rest of the app degrades gracefully.
//
// To enable: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER
// in the environment.

export function smsConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return false;

  const clean = to.trim();
  if (!clean) return false;

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        },
        body: new URLSearchParams({ To: clean, From: from, Body: body }).toString(),
      }
    );
    if (!res.ok) {
      console.error("[sms] Twilio error:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[sms] sendSms failed:", err);
    return false;
  }
}
