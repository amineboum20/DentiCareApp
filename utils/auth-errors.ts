// Supabase Auth returns English messages ("Invalid login credentials"…). Map
// them to an `authErrors.<key>` message so the UI speaks the chosen language.
// Prefer the stable error `code`; fall back to the message for older responses.

const BY_CODE: Record<string, string> = {
  invalid_credentials: "invalidCredentials",
  email_not_confirmed: "emailNotConfirmed",
  user_already_exists: "emailExists",
  email_exists: "emailExists",
  weak_password: "weakPassword",
  same_password: "samePassword",
  over_email_send_rate_limit: "emailRateLimit",
  over_request_rate_limit: "rateLimit",
  email_address_invalid: "invalidEmail",
  validation_failed: "invalidEmail",
  user_banned: "userBanned",
  session_not_found: "sessionExpired",
  session_expired: "sessionExpired",
  otp_expired: "sessionExpired",
};

const BY_MESSAGE: [RegExp, string][] = [
  [/invalid login credentials/i, "invalidCredentials"],
  [/email not confirmed/i, "emailNotConfirmed"],
  [/already registered|already exists/i, "emailExists"],
  [/password should be|weak password/i, "weakPassword"],
  [/should be different from the old/i, "samePassword"],
  [/rate limit|too many requests|security purposes/i, "rateLimit"],
  [/invalid.*email|email.*invalid/i, "invalidEmail"],
  [/session missing|expired/i, "sessionExpired"],
];

export function authErrorKey(err: { code?: string | null; message?: string | null } | null | undefined): string {
  if (!err) return "generic";
  if (err.code && BY_CODE[err.code]) return BY_CODE[err.code];
  const msg = err.message ?? "";
  for (const [re, key] of BY_MESSAGE) if (re.test(msg)) return key;
  return "generic";
}
