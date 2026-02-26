# Requirements Document

## Introduction

Upgrade the HypertrophyOS React Native app from Expo SDK 50 to Expo SDK 52 to resolve a critical EAS build failure caused by an incompatibility between SDK 50's generated `settings.gradle` and Gradle 8.3 (missing `expo-module-gradle-plugin` registration via `includeBuild`). The upgrade brings React Native 0.76.x with New Architecture enabled by default, removes the deprecated `expo-barcode-scanner` package, and aligns all `expo-*` dependencies to their SDK 52 compatible versions.

## Glossary

- **SDK**: Expo Software Development Kit — the versioned set of Expo libraries and tooling
- **EAS**: Expo Application Services — the cloud build service used to compile the app
- **New Architecture**: React Native's new rendering system (Fabric + JSI) enabled by default in RN 0.76.x
- **Prebuild**: The EAS step that generates native `android/` and `ios/` folders from `app.json` and `package.json`
- **Upgrade_Script**: The `npx expo install --fix` command that aligns all `expo-*` packages to the target SDK
- **BarcodeScanner_Component**: `app/components/nutrition/BarcodeScanner.tsx` — the component that handles camera-based barcode scanning
- **expo-barcode-scanner**: The deprecated Expo package removed in SDK 52; its functionality is absorbed by `expo-camera`
- **expo-camera**: The Expo camera package that in SDK 52 provides both camera preview and barcode scanning via `CameraView`

## Requirements

### Requirement 1: Core SDK Version Bump

**User Story:** As a developer, I want to upgrade `expo` to `~52.0.0` and `react-native` to `0.76.x`, so that the app uses a supported SDK version that is compatible with the EAS build environment's Gradle 8.3.

#### Acceptance Criteria

1. THE Upgrade_Script SHALL update the `expo` dependency in `app/package.json` to `~52.0.0`
2. THE Upgrade_Script SHALL update `react-native` in `app/package.json` to the version peer-required by Expo SDK 52 (0.76.x)
3. WHEN `yarn install` is run after the version bump, THE Upgrade_Script SHALL produce an updated `yarn.lock` with no unresolved peer dependency conflicts for core Expo packages
4. THE Upgrade_Script SHALL update `react` to the version peer-required by React Native 0.76.x (18.3.x)

### Requirement 2: Expo Package Alignment

**User Story:** As a developer, I want all `expo-*` packages updated to their SDK 52 compatible versions, so that there are no version mismatches that cause runtime errors or build failures.

#### Acceptance Criteria

1. THE Upgrade_Script SHALL update every `expo-*` package in `app/package.json` to the version compatible with SDK 52 as specified by `npx expo install --fix`
2. WHEN the updated `app/package.json` is inspected, THE Upgrade_Script SHALL have set `expo-camera` to `~16.0.x` (the SDK 52 compatible version)
3. WHEN the updated `app/package.json` is inspected, THE Upgrade_Script SHALL have set `expo-av` to `~15.0.x` (the SDK 52 compatible version)
4. WHEN the updated `app/package.json` is inspected, THE Upgrade_Script SHALL have set `expo-haptics` to `~14.0.x` (the SDK 52 compatible version)
5. WHEN the updated `app/package.json` is inspected, THE Upgrade_Script SHALL have set `expo-secure-store` to `~14.0.x` (the SDK 52 compatible version)
6. WHEN the updated `app/package.json` is inspected, THE Upgrade_Script SHALL have set `expo-file-system` to `~18.0.x` (the SDK 52 compatible version)
7. WHEN the updated `app/package.json` is inspected, THE Upgrade_Script SHALL have set `expo-image-picker` to `~16.0.x` (the SDK 52 compatible version)
8. WHEN the updated `app/package.json` is inspected, THE Upgrade_Script SHALL have set `expo-status-bar` to `~2.0.x` (the SDK 52 compatible version)
9. WHEN the updated `app/package.json` is inspected, THE Upgrade_Script SHALL have set `@expo/metro-runtime` to `~4.0.x` (the SDK 52 compatible version)
10. WHEN the updated `app/package.json` is inspected, THE Upgrade_Script SHALL have set `react-native-reanimated` to `~3.16.x` (the SDK 52 compatible version)
11. WHEN the updated `app/package.json` is inspected, THE Upgrade_Script SHALL have set `react-native-screens` to `~4.4.x` (the SDK 52 compatible version)
12. WHEN the updated `app/package.json` is inspected, THE Upgrade_Script SHALL have set `react-native-safe-area-context` to `4.12.x` (the SDK 52 compatible version)

### Requirement 3: Remove expo-barcode-scanner

**User Story:** As a developer, I want to remove the `expo-barcode-scanner` package that was deprecated and removed in SDK 52, so that the app does not reference a non-existent package.

#### Acceptance Criteria

1. WHEN `app/package.json` is inspected after the upgrade, THE Upgrade_Script SHALL have removed `expo-barcode-scanner` from the dependencies
2. WHEN `app/components/nutrition/BarcodeScanner.tsx` is inspected, THE BarcodeScanner_Component SHALL contain no `require('expo-barcode-scanner')` or `import` statements referencing `expo-barcode-scanner`
3. WHEN a search is performed across all files in `app/`, THE Upgrade_Script SHALL find zero references to `expo-barcode-scanner`

### Requirement 4: Migrate Barcode Scanning to expo-camera

**User Story:** As a user, I want to scan food barcodes using the camera, so that I can quickly log food items without manual search.

#### Acceptance Criteria

1. WHEN the BarcodeScanner_Component renders in scanning state, THE BarcodeScanner_Component SHALL use `CameraView` from `expo-camera` (SDK 52 API) instead of the removed `BarCodeScanner` component
2. WHEN a barcode is detected by the camera, THE BarcodeScanner_Component SHALL invoke the scan handler with the barcode data via the `onBarcodeScanned` prop on `CameraView`
3. WHEN requesting camera permissions, THE BarcodeScanner_Component SHALL use `useCameraPermissions` hook from `expo-camera` (SDK 52 API)
4. WHEN the BarcodeScanner_Component is rendered on web or when `expo-camera` is unavailable, THE BarcodeScanner_Component SHALL display a fallback message indicating barcode scanning is mobile-only
5. WHEN a barcode is scanned, THE BarcodeScanner_Component SHALL pass the `data` field from the scan result to the API lookup function
6. THE BarcodeScanner_Component SHALL enable barcode scanning on `CameraView` by setting the `barcodeScannerSettings` prop with the supported barcode types

### Requirement 5: New Architecture Compatibility

**User Story:** As a developer, I want the app to be compatible with React Native's New Architecture (enabled by default in RN 0.76.x), so that the app builds and runs correctly on SDK 52.

#### Acceptance Criteria

1. WHEN `app/app.json` is inspected, THE Upgrade_Script SHALL have set `expo.newArchEnabled` to `true` or left it absent (defaulting to enabled in SDK 52)
2. IF any third-party package in `app/package.json` is known to be incompatible with New Architecture, THEN THE Upgrade_Script SHALL either update it to a compatible version or add an explicit opt-out with justification in a code comment
3. WHEN `react-native-reanimated` is updated to `~3.16.x`, THE Upgrade_Script SHALL confirm this version supports New Architecture

### Requirement 6: EAS Configuration Update

**User Story:** As a developer, I want the EAS CLI version constraint updated to support SDK 52 builds, so that EAS Build does not reject the configuration.

#### Acceptance Criteria

1. WHEN `app/eas.json` is inspected after the upgrade, THE Upgrade_Script SHALL have set the `cli.version` constraint to `>= 13.0.0` (the minimum EAS CLI version that fully supports SDK 52)

### Requirement 7: TypeScript Compilation

**User Story:** As a developer, I want the TypeScript compiler to report zero errors after the upgrade, so that I have confidence the code changes are type-correct.

#### Acceptance Criteria

1. WHEN `tsc --noEmit` is run in the `app/` directory after all changes, THE Upgrade_Script SHALL produce zero TypeScript errors
2. WHEN `app/components/nutrition/BarcodeScanner.tsx` is type-checked, THE BarcodeScanner_Component SHALL have correct types for all `expo-camera` SDK 52 APIs used

### Requirement 8: Lockfile Consistency

**User Story:** As a developer, I want `yarn.lock` regenerated after all package changes, so that EAS Build installs the exact correct dependency versions.

#### Acceptance Criteria

1. WHEN `yarn install` is run in `app/` after all `package.json` changes, THE Upgrade_Script SHALL update `yarn.lock` to reflect the new dependency tree
2. WHEN `yarn install` completes, THE Upgrade_Script SHALL produce no `error` level output related to unresolved packages
