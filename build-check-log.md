# Repwise Build Check Log

## 2026-04-12 23:24 IST — Cron Build Check

**Build:** `5d8fdd02-bef1-460d-a64d-4b7ac0dd2720`
**Status:** ❌ ERRORED (terminal)
**Error:** `XCODE_BUILD_ERROR` — `type 'EXPermissionsService' has no member 'parsePermission'`
**Failed at:** 2026-04-09 16:32 UTC
**Slack notification:** Failed (302 auth errors on channel C0AK498UN5P and DM)

**Next steps:**
1. `npx expo install --fix` in `/Users/manavmht/Documents/HOS/app`
2. Remove `expo-permissions` if present (deprecated since SDK 41)
3. Retrigger: `eas build --platform ios --profile production`
