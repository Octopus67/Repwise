# Implementation Plan: Expo SDK 52 Upgrade

## Overview

Upgrade HypertrophyOS from Expo SDK 50 / React Native 0.73.6 to Expo SDK 52 / React Native 0.76.x.
**Root cause being fixed:** SDK 50's generated `settings.gradle` does not register `expo-module-gradle-plugin` via `includeBuild`, causing Gradle 8.3 to fail. SDK 52 ships a fixed prebuild template.

**No backend changes. No DB migrations. No feature flags needed.**
**Rollback strategy for all steps:** `git revert HEAD` or `git checkout main -- app/package.json app/yarn.lock` restores the previous state. EAS builds are immutable — old builds remain downloadable.

---

## Phase 0: Audit & Prerequisite Verification

- [x] 0. Audit third-party package compatibility with RN 0.76 / New Architecture
  - Files: `app/package.json` (read-only audit)
  - Details: Before touching any file, verify these packages support RN 0.76 + New Architecture. Check each package's GitHub releases page or npm for a version that explicitly supports RN 0.76:
    - `victory-native ^41.20.2` — v41.x uses Skia; confirm it supports RN 0.76 New Arch. If not, pin to a known-good version (v36.x is the legacy non-Skia version that works everywhere).
    - `@sentry/react-native ^5.0.0` — v5.x supports RN 0.76. No change needed.
    - `posthog-react-native ^3.0.0` — v3.x supports RN 0.76. No change needed.
    - `react-native-gesture-handler ^2.14.0` — needs `^2.20.0` for RN 0.76 New Arch.
    - `react-native-svg ^15.15.3` — v15.x supports RN 0.76. No change needed.
    - `react-native-markdown-display ^7.0.2` — check if it supports New Arch; if not, add `"newArchEnabled": false` to `app.json` as a temporary opt-out (document the reason).
    - `@react-navigation/native-stack ^7.12.0` — v7.x supports RN 0.76. No change needed.
  - Depends on: none
  - Test: Document findings in a comment at the top of this file before proceeding. If any package is incompatible and has no fix, decide: upgrade the package, or opt out of New Architecture for v1.
  - Rollback: n/a (read-only)
  - Risk: `victory-native` v41.x with Skia may have New Arch issues. `react-native-markdown-display` is a known New Arch laggard.
  - Time: S

---

## Phase 1: Package Version Bumps

- [x] 1. Update core SDK versions in package.json
  - Files: `app/package.json` (modify)
  - Details: Apply ALL of the following changes in a single edit to `app/package.json`. Do not run `yarn install` yet — that is Step 3.
    - Change `"expo": "~50.0.0"` → `"expo": "~52.0.0"`
    - Change `"react-native": "0.73.6"` → `"react-native": "0.76.9"`
    - Change `"react": "18.2.0"` → `"react": "18.3.1"`
    - Change `"react-dom": "18.2.0"` → `"react-dom": "18.3.1"`
    - Change `"@expo/metro-runtime": "~3.1.3"` → `"@expo/metro-runtime": "~4.0.1"`
    - Change `"expo-av": "~13.10.6"` → `"expo-av": "~15.0.2"`
    - Change `"expo-camera": "~14.1.3"` → `"expo-camera": "~16.0.18"`
    - Change `"expo-file-system": "~16.0.9"` → `"expo-file-system": "~18.0.12"`
    - Change `"expo-haptics": "~12.8.1"` → `"expo-haptics": "~14.0.1"`
    - Change `"expo-image-picker": "^17.0.10"` → `"expo-image-picker": "~16.0.6"`
    - Change `"expo-secure-store": "~13.0.0"` → `"expo-secure-store": "~14.0.1"`
    - Change `"expo-status-bar": "~1.11.0"` → `"expo-status-bar": "~2.0.1"`
    - Change `"react-native-reanimated": "~3.6.0"` → `"react-native-reanimated": "~3.16.7"`
    - Change `"react-native-safe-area-context": "4.8.2"` → `"react-native-safe-area-context": "4.12.0"`
    - Change `"react-native-screens": "~3.29.0"` → `"react-native-screens": "~4.4.0"`
    - Change `"react-native-gesture-handler": "^2.14.0"` → `"react-native-gesture-handler": "^2.20.0"`
    - **REMOVE** the line `"expo-barcode-scanner": "~12.9.3"` entirely
    - Change `"react-native-web": "~0.19.6"` → `"react-native-web": "~0.19.13"` (latest 0.19.x compatible with RN 0.76)
  - Depends on: Step 0 (audit complete)
  - Test: `cat app/package.json | grep '"expo"'` should show `~52.0.0`. `grep 'expo-barcode-scanner' app/package.json` should return nothing.
  - Rollback: `git checkout HEAD -- app/package.json`
  - Risk: Medium — if any package version is wrong, `yarn install` in Step 3 will fail with a peer conflict. Fix by adjusting the specific version.
  - Time: S

- [ ] 2. Update EAS and app config files
  - [x] 2.1 Update eas.json CLI version constraint
    - Files: `app/eas.json` (modify)
    - Details: Change `"cli": { "version": ">= 12.0.0" }` to `"cli": { "version": ">= 13.0.0" }`. No other changes to `eas.json`.
    - Depends on: none (can run in parallel with Step 1)
    - Test: `cat app/eas.json | grep version` shows `>= 13.0.0`
    - Rollback: `git checkout HEAD -- app/eas.json`
    - Risk: Low
    - Time: S

  - [x] 2.2 Update app.json — add newArchEnabled
    - Files: `app/app.json` (modify)
    - Details: Add `"newArchEnabled": true` as a top-level key inside the `"expo"` object, after `"owner": "octopus67"`. If Step 0 found that `react-native-markdown-display` is incompatible with New Architecture, set this to `false` instead and add a comment in this tasks.md explaining why.
    - Depends on: Step 0 (audit result determines true/false)
    - Test: `cat app/app.json | grep newArchEnabled` shows the key
    - Rollback: `git checkout HEAD -- app/app.json`
    - Risk: Low if all packages support New Arch; Medium if any don't
    - Time: S

---

## Phase 2: BarcodeScanner Migration

- [x] 3. Migrate BarcodeScanner.tsx from expo-barcode-scanner to expo-camera SDK 52 API
  - Files: `app/components/nutrition/BarcodeScanner.tsx` (modify)
  - Details: This is the only source file requiring logic changes. The current file lazy-requires BOTH `expo-barcode-scanner` (for `BarCodeScanner` component) AND `expo-camera` (for `Camera.getCameraPermissionsAsync()`). Replace both with the SDK 52 `expo-camera` API:

    **Remove the entire lazy-import block (lines ~47-57):**
    ```tsx
    let BarCodeScanner: any = null;
    let Camera: any = null;
    let Haptics: any = null;

    try {
      BarCodeScanner = require('expo-barcode-scanner').BarCodeScanner;
      Camera = require('expo-camera').Camera;
    } catch { }

    try {
      Haptics = require('expo-haptics');
    } catch { }
    ```

    **Replace with top-level imports:**
    ```tsx
    import { CameraView, useCameraPermissions } from 'expo-camera';
    import * as Haptics from 'expo-haptics';
    ```

    **Update the web guard** (currently checks `!BarCodeScanner || !Camera`):
    ```tsx
    // Before:
    if (Platform.OS === 'web' || !BarCodeScanner || !Camera) {
    // After:
    if (Platform.OS === 'web') {
    ```

    **Replace the permission useEffect + checkPermission function** with the hook pattern. Add `useCameraPermissions` hook call at the top of the component body (before the web guard):
    ```tsx
    const [permission, requestPermission] = useCameraPermissions();
    ```

    **Replace the `useEffect` + `checkPermission` function** entirely. Instead, add a `useEffect` that reacts to the `permission` object:
    ```tsx
    useEffect(() => {
      if (!permission) return; // still loading
      if (permission.granted) {
        setState('scanning');
      } else if (permission.canAskAgain) {
        requestPermission().then(result => {
          setState(result.granted ? 'scanning' : 'denied');
        });
      } else {
        setState('denied');
      }
    }, [permission?.status]);
    ```

    **Replace the `<BarCodeScanner>` render** in the scanning state:
    ```tsx
    // Before:
    <BarCodeScanner
      onBarCodeScanned={handleBarCodeScanned}
      style={StyleSheet.absoluteFillObject}
    />
    // After:
    <CameraView
      style={StyleSheet.absoluteFillObject}
      onBarcodeScanned={handleBarCodeScanned}
      barcodeScannerSettings={{
        barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128', 'code39'],
      }}
    />
    ```

    **Note:** The `handleBarCodeScanned` callback signature `({ type, data }: { type: string; data: string })` is unchanged. The `Haptics` import changes from lazy-require to top-level import, so remove the `if (Haptics)` guard — just call `Haptics.impactAsync(...)` directly inside a try/catch.

    **Keep unchanged:** All state machine logic, debounce logic, confirmation card, not-found card, denied card, loading card, all styles.

  - Depends on: Step 1 (expo-barcode-scanner removed from package.json)
  - Test: `grep -r 'expo-barcode-scanner' app/components app/screens app/utils` returns zero results. `grep -r 'BarCodeScanner' app/components` returns zero results. File compiles without errors (verified in Step 6).
  - Rollback: `git checkout HEAD -- app/components/nutrition/BarcodeScanner.tsx`
  - Risk: Medium — `useCameraPermissions` hook behavior differs slightly from the imperative `getCameraPermissionsAsync` flow. The `permission` object is `null` on first render before the OS responds, so the `useEffect` must guard against `null`.
  - Time: M

---

## Phase 3: Lockfile Regeneration & Verification

- [x] 4. Verify zero expo-barcode-scanner references remain
  - Files: none (read-only check)
  - Details: Run the following searches and confirm zero matches in `.ts`, `.tsx`, `.json` files (excluding `yarn.lock` and `node_modules`):
    - `grep -r 'expo-barcode-scanner' app/components app/screens app/utils app/hooks app/navigation app/store app/services`
    - `grep -r 'BarCodeScanner' app/components app/screens app/utils`
    - `grep 'expo-barcode-scanner' app/package.json`
  - Depends on: Steps 1, 3
  - Test: All three greps return empty output
  - Rollback: n/a (read-only)
  - Risk: Low
  - Time: S

- [x] 5. Regenerate yarn.lock
  - Files: `app/yarn.lock` (regenerate), `app/node_modules/` (updated)
  - Details: Run `yarn install` inside the `app/` directory. This regenerates `yarn.lock` with the new dependency tree. Expected outcome: yarn resolves all packages without errors. If peer dependency warnings appear for non-critical packages, they are acceptable. If `yarn install` exits with a non-zero code due to a peer conflict, identify the conflicting package and either update it to a compatible version or add it to `resolutions` in `package.json`. Do NOT use `--legacy-peer-deps` unless absolutely necessary — if used, document the reason in a comment in `package.json`.
  - Depends on: Steps 1, 2.1, 2.2, 3, 4
  - Test: `yarn install` exits with code 0. `cat app/yarn.lock | grep '"expo"'` shows `52.x.x`. `cat app/yarn.lock | grep 'expo-barcode-scanner'` returns nothing.
  - Rollback: `git checkout HEAD -- app/yarn.lock` (restores old lockfile; run `yarn install` again to restore node_modules)
  - Risk: Medium — peer conflicts are possible with `victory-native` or `react-native-markdown-display`. Fix by adjusting versions.
  - Time: M

- [x] 6. TypeScript check — zero errors
  - Files: none (read-only check)
  - Details: Run `yarn typecheck` (which runs `tsc --noEmit`) inside the `app/` directory. Fix any type errors introduced by the SDK 52 API changes. Most likely locations:
    - `app/components/nutrition/BarcodeScanner.tsx` — `CameraView` props, `useCameraPermissions` return type
    - Any file that imported from `expo-barcode-scanner` (should be none after Step 3)
    - `expo-av` API changes between v13 and v15 — check `app/screens/` for any `Audio` or `Video` usage
  - Depends on: Step 5 (node_modules must be updated before tsc can resolve new types)
  - Test: `yarn typecheck` exits with code 0 and prints zero errors
  - Rollback: Fix the type errors — do not skip this step
  - Risk: Medium — `expo-av` v15 has API changes; `expo-camera` v16 types differ from v14
  - Time: M

- [x] 7. Run existing Jest test suite
  - Files: none (read-only check)
  - Details: Run `yarn jest --testPathPattern='BarcodeScanner|barcode' --run` inside `app/`. The existing `BarcodeScanner.test.ts` tests pure logic (scaling, debounce, state machine, validation) — these should all pass unchanged since the logic is untouched. If any test fails, fix the test or the implementation.
  - Depends on: Steps 3, 5, 6
  - Test: All tests in `BarcodeScanner.test.ts` pass. Zero failures.
  - Rollback: Fix failing tests — do not skip
  - Risk: Low — existing tests are pure logic tests with no component rendering or module mocks
  - Time: S

---

## Phase 4: Commit & EAS Build

- [x] 8. Commit all changes
  - Files: `app/package.json`, `app/yarn.lock`, `app/eas.json`, `app/app.json`, `app/components/nutrition/BarcodeScanner.tsx`
  - Details:
    ```bash
    git add app/package.json app/yarn.lock app/eas.json app/app.json app/components/nutrition/BarcodeScanner.tsx
    git commit -m "chore: upgrade Expo SDK 50 → 52, RN 0.73 → 0.76, migrate BarcodeScanner to expo-camera"
    git push origin main
    ```
  - Depends on: Steps 1–7 all passing
  - Test: `git log --oneline -1` shows the commit. `git status` is clean.
  - Rollback: `git revert HEAD` — creates a revert commit that undoes all changes
  - Risk: Low
  - Time: S

- [x] 9. Trigger EAS Android build with --clear-cache
  - Files: none
  - Details: Run from the `app/` directory:
    ```bash
    eas build --profile production --platform android --clear-cache
    ```
    The `--clear-cache` flag forces EAS to reinstall all packages fresh, ensuring the new `yarn.lock` is used. Monitor the build logs. The Prebuild phase should now generate a `settings.gradle` that includes `expo-module-gradle-plugin` via `includeBuild`. The Gradle phase should complete without the `expo-module-gradle-plugin was not found` error.
  - Depends on: Step 8
  - Test: Build completes successfully. EAS dashboard shows green. `.aab` file is available for download.
  - Rollback: If build fails, check the specific error in EAS logs. If it's a new error (not the original Gradle error), diagnose and fix. If the original Gradle error persists, the issue is in the EAS build environment itself — open an issue at github.com/expo/expo.
  - Risk: Medium — if a third-party package (e.g., `victory-native`) is incompatible with New Architecture, the build will fail with a different error. Fix by setting `"newArchEnabled": false` in `app.json` and rebuilding.
  - Time: L (20-30 min build queue + build time)

---

## 🚦 CHECKPOINT: Build passes

Before proceeding to any other work:
- EAS build status: green
- `.aab` file downloadable from EAS dashboard
- No Gradle errors in build logs

---

## Post-Launch Monitoring

| What to Monitor | How | Alert Threshold |
|---|---|---|
| EAS build success rate | EAS dashboard | Any failure after green |
| Barcode scan success rate | Railway logs: `GET /api/v1/food/barcode/` | Error rate > 5% |
| App crash rate | Sentry (once DSN is configured) | Any increase > 0.1% |
| Camera permission grant rate | PostHog (once key is configured) | < 60% grant rate (investigate UX) |
| Existing test suite | CI on next push | Any test failure |

---

## Deferred to V2

| Item | Why Deferred | When to Revisit |
|---|---|---|
| Property-based tests for BarcodeScanner | Existing pure-logic tests cover the unchanged business logic; component render tests require a React Native test renderer setup that is not yet configured | After SDK 52 build is confirmed green |
| iOS EAS build | Requires paid Apple Developer account ($99/yr) | When Apple Developer account is purchased |
| `react-native-markdown-display` New Arch migration | May require a fork or replacement if incompatible | SDK 53 or when a compatible version is released |
| `victory-native` v41 Skia New Arch validation | Skia-based charts have known New Arch edge cases | After first successful build — test on device |
| Upgrade to SDK 53/54 | SDK 52 is the target; further upgrades are separate work | 6 months post-launch |
