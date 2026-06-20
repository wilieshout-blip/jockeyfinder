export function friendlyAuthError(
  error: unknown,
  fallback = "Something went wrong. Please try again."
) {
  let message = "";

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; error_description?: unknown };
    if (typeof candidate.message === "string") message = candidate.message;
    else if (typeof candidate.error_description === "string") {
      message = candidate.error_description;
    }
  }

  const normalized = message.trim();
  const lower = normalized.toLowerCase();

  if (!normalized || normalized === "{}" || normalized === "[object Object]") {
    return fallback;
  }
  if (lower.includes("invalid login credentials")) {
    return "That email or password is not correct.";
  }
  if (
    lower.includes("email rate limit exceeded") ||
    (lower.includes("rate limit") && lower.includes("email"))
  ) {
    return "Too many account emails were requested. Please wait an hour before trying again.";
  }
  if (
    lower.includes("database error querying schema") ||
    lower.includes("unexpected_failure")
  ) {
    return "JockeyFinder's account service is temporarily unavailable. Please try again shortly.";
  }
  if (
    lower.includes("invalid api key") ||
    lower.includes("failed to fetch") ||
    lower.includes("network")
  ) {
    return "JockeyFinder could not reach the account service. Please try again shortly.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirm your email address before logging in.";
  }
  if (lower.includes("user already registered")) {
    return "An account already exists for this email. Try logging in instead.";
  }

  return normalized;
}
