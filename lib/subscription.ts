import { BILLING_START_DATE, ROLE_TRIAL_DAYS } from "./stripe";

export type AccessStatus =
  | "free_period"
  | "trialing"
  | "active"
  | "past_due"
  | "expired";

export function getTrialEnd(
  role: string,
  trialStartDate: string | Date | null
): Date {
  const days = ROLE_TRIAL_DAYS[role] ?? 30;
  const signup = trialStartDate ? new Date(trialStartDate) : new Date();
  const effectiveStart = signup < BILLING_START_DATE ? BILLING_START_DATE : signup;
  return new Date(effectiveStart.getTime() + days * 86_400_000);
}

/** Trial-jumpout-only riders ("trial riders") get a free account. */
export function isFreeLicence(licenceType?: string | null): boolean {
  return licenceType === "trial_jumpout_only";
}

export function getAccessStatus(opts: {
  role: string;
  trialStartDate: string | Date | null;
  stripeStatus: string | null;
  licenceType?: string | null;
}): AccessStatus {
  const now = new Date();
  if (opts.role === "agent" || opts.role === "admin") return "active";
  if (isFreeLicence(opts.licenceType)) return "active";
  if (now < BILLING_START_DATE) return "free_period";
  if (opts.stripeStatus === "active") return "active";
  if (opts.stripeStatus === "trialing") return "active";
  if (opts.stripeStatus === "past_due") return "past_due";
  const trialEnd = getTrialEnd(opts.role, opts.trialStartDate);
  if (now < trialEnd) return "trialing";
  return "expired";
}

export function canAccess(status: AccessStatus): boolean {
  return status !== "expired" && status !== "past_due";
}

export function daysUntilTrialEnd(
  role: string,
  trialStartDate: string | Date | null
): number {
  const end = getTrialEnd(role, trialStartDate);
  return Math.ceil((end.getTime() - Date.now()) / 86_400_000);
}
