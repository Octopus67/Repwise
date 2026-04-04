# Security Notes

## CSRF Protection

This application uses Bearer token authentication (JWT) for all API requests.
Tokens are sent via the `Authorization` header, never via cookies.

Since browsers do not automatically attach `Authorization` headers to
cross-origin requests (unlike cookies), the application is not vulnerable
to CSRF attacks. This is an intentional design decision.

If cookie-based authentication is ever added, CSRF protection (e.g.,
double-submit cookie or synchronizer token pattern) must be implemented.

## Rate Limiting

- Global: 100 requests/minute per IP (configurable via `RATE_LIMIT_RPM`)
- Login: 5 attempts/15 minutes per email (in-memory + DB-backed)
- Registration: 5 attempts/hour per IP
- Password reset: 5 attempts/15 minutes per email (in-memory + DB-backed)
- Forgot password: 3 requests/15 minutes per email
- OAuth: 10 attempts/15 minutes per IP

## Request Body Limits

- General API: 1 MB maximum
- File uploads: 10 MB maximum

## IP Extraction

Client IPs are extracted from the `X-Forwarded-For` header set by Railway's
reverse proxy. Railway replaces (not appends to) this header, so the first
IP is always the real client IP. Suspiciously long XFF chains are logged.

## Web Token Storage

On mobile (iOS/Android), tokens are stored in `expo-secure-store` (encrypted keychain).
On web, tokens are stored in `localStorage` which is accessible to JavaScript.
This is a known tradeoff for SPAs using JWT Bearer tokens.

If an XSS vulnerability exists, web tokens could be exfiltrated.
Mitigations: strict CSP headers, no `dangerouslySetInnerHTML`, input sanitization.
For higher security on web, consider migrating to httpOnly cookie auth.