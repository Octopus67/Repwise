# Requirements Document

## Introduction

Camera-based barcode scanner for the Repwise nutrition logging flow. This feature replaces the current text-input-only barcode lookup with a real-time camera scanner that reads barcodes (EAN-13, UPC-A, Code 128) from the device camera, looks up the food in Open Food Facts (with USDA fallback), and auto-fills the nutrition entry. The scanner opens as a full-screen camera view from the barcode icon in the Log Nutrition modal, scans continuously until a valid barcode is detected, shows the food result inline, and allows the user to confirm and add it to their log. The feature is gated behind a `camera_barcode_scanner` feature flag for phased rollout.

## Glossary

- **Scanner_Screen**: The full-screen camera view that captures and decodes barcodes from the device camera in real time
- **Barcode_Detector**: The subsystem within Scanner_Screen that uses `expo-camera` CameraView's `onBarcodeScanned` callback to detect EAN-13, UPC-A, EAN-8, UPC-E, and Code 128 barcodes
- **Lookup_Service**: The existing backend barcode lookup chain (cache → Open Food Facts → USDA) at `GET /food-database/barcode/{barcode}`
- **Result_Card**: The inline UI card displayed after a successful barcode lookup showing food name, macros, serving size, and a confirm/cancel action row
- **Scan_Overlay**: The semi-transparent camera overlay with corner markers delineating the scan area and instructional text
- **Permission_Manager**: The subsystem that requests, checks, and handles camera permission states using `expo-camera` `useCameraPermissions`
- **Feature_Flag_Gate**: The mechanism that checks the `camera_barcode_scanner` feature flag to determine whether to show the camera scanner or fall back to text input
- **Manual_Entry_Fallback**: The text-input barcode entry mode used on web or when the camera scanner is unavailable
- **Nutrition_Modal**: The existing `AddNutritionModal` component that hosts the barcode scanner entry point

## Requirements

### Requirement 1: Feature Flag Gating

**User Story:** As a product manager, I want the camera barcode scanner gated behind a feature flag, so that I can control phased rollout (internal → 10% → 50% → 100%).

#### Acceptance Criteria

1. WHEN the `camera_barcode_scanner` feature flag is disabled, THE Feature_Flag_Gate SHALL display the Manual_Entry_Fallback (text input) instead of the camera scanner
2. WHEN the `camera_barcode_scanner` feature flag is enabled for a user, THE Feature_Flag_Gate SHALL display the camera scanner barcode icon in the Nutrition_Modal
3. THE Feature_Flag_Gate SHALL evaluate the flag on each modal open without caching the result across sessions

### Requirement 2: Camera Permission Handling

**User Story:** As a first-time user, I want the app to request camera permission clearly and handle denial gracefully, so that I understand why the camera is needed and can still use the app if I decline.

#### Acceptance Criteria

1. WHEN the Scanner_Screen opens and camera permission has not been requested, THE Permission_Manager SHALL request camera permission from the operating system
2. WHEN the user grants camera permission, THE Permission_Manager SHALL transition the Scanner_Screen to the active scanning state within 500ms
3. WHEN the user denies camera permission, THE Permission_Manager SHALL display a message explaining that camera access is required and provide a button to open device settings
4. WHEN the user denies camera permission, THE Permission_Manager SHALL provide a fallback option to close the scanner and return to the Nutrition_Modal for manual entry
5. WHILE the Scanner_Screen is active and camera permission is revoked externally, THE Permission_Manager SHALL detect the revocation and display the denied state

### Requirement 3: Real-Time Barcode Scanning

**User Story:** As a meal-prepping lifter, I want to point my camera at a barcode and have it detected instantly, so that I can log food in 2 taps instead of typing a 13-digit number.

#### Acceptance Criteria

1. WHILE the Scanner_Screen is in the active scanning state, THE Barcode_Detector SHALL continuously scan for EAN-13, UPC-A, EAN-8, UPC-E, and Code 128 barcodes
2. WHEN the Barcode_Detector detects a valid barcode, THE Scanner_Screen SHALL trigger haptic feedback (medium impact) on the device
3. WHEN the Barcode_Detector detects a valid barcode, THE Scanner_Screen SHALL debounce repeated scans of the same barcode within a 2-second window
4. WHILE the Scanner_Screen is scanning, THE Scan_Overlay SHALL display corner markers delineating the scan area and instructional text ("Point camera at barcode")
5. WHEN a barcode is detected, THE Scanner_Screen SHALL transition to the loading state and initiate a lookup via the Lookup_Service

### Requirement 4: Barcode Lookup and Result Display

**User Story:** As a grocery shopper, I want to see the food's name and macros immediately after scanning, so that I can decide whether to buy it before it leaves my hand.

#### Acceptance Criteria

1. WHEN the Lookup_Service returns a matching food item, THE Result_Card SHALL display the food name, calories, protein, carbs, fat, and serving size
2. WHEN the Lookup_Service returns a matching food item, THE Result_Card SHALL display a serving multiplier input defaulting to "1"
3. WHEN the user changes the serving multiplier on the Result_Card, THE Result_Card SHALL recalculate and display scaled macro values in real time
4. WHEN the Lookup_Service returns no matching food item, THE Scanner_Screen SHALL display a "Not Found" message with options to scan again or search manually
5. IF the Lookup_Service request fails due to a network error, THEN THE Scanner_Screen SHALL display an error message and offer a retry option

### Requirement 5: Confirm and Log Flow

**User Story:** As a user who just scanned a protein bar, I want to confirm the food and have it added to my nutrition log instantly, so that I can get back to my meal prep.

#### Acceptance Criteria

1. WHEN the user taps "Add" on the Result_Card with a valid multiplier, THE Scanner_Screen SHALL submit the scaled nutrition entry to the nutrition logging API for the selected date
2. WHEN the nutrition entry is successfully logged, THE Scanner_Screen SHALL close and return the user to the Nutrition_Modal
3. WHEN the user taps "Cancel" on the Result_Card, THE Scanner_Screen SHALL return to the active scanning state for the next barcode
4. IF the nutrition logging API call fails, THEN THE Scanner_Screen SHALL display an error message and keep the Result_Card visible for retry

### Requirement 6: Platform Fallback

**User Story:** As a web user, I want to still be able to enter barcodes manually, so that the feature degrades gracefully on platforms without camera access.

#### Acceptance Criteria

1. WHILE the application is running on web (Platform.OS === 'web'), THE Scanner_Screen SHALL display the Manual_Entry_Fallback with a text input for barcode numbers instead of the camera view
2. WHEN a user submits a barcode via the Manual_Entry_Fallback, THE Lookup_Service SHALL perform the same lookup chain as the camera scanner
3. THE Manual_Entry_Fallback SHALL validate that the entered barcode is 8-14 digits before submitting to the Lookup_Service

### Requirement 7: Premium UX Polish

**User Story:** As a user evaluating Repwise against competitors, I want the scanner to feel instant and polished, so that I feel confident this app is worth paying for.

#### Acceptance Criteria

1. WHEN a barcode is successfully detected, THE Scanner_Screen SHALL provide haptic feedback using `expo-haptics` ImpactFeedbackStyle.Medium
2. WHEN transitioning between scanner states (scanning → loading → found/not_found), THE Scanner_Screen SHALL use smooth animated transitions
3. THE Scan_Overlay SHALL render corner markers in the app's accent color (`colors.accent.primary`) with a semi-transparent dark background

### Requirement 8: Barcode Validation

**User Story:** As a developer, I want barcode inputs validated consistently on both client and server, so that invalid barcodes never reach the API.

#### Acceptance Criteria

1. THE Barcode_Detector SHALL only forward barcodes matching the pattern `^\d{8,14}$` to the Lookup_Service
2. WHEN the backend receives a barcode not matching `^\d{8,14}$`, THE Lookup_Service SHALL return HTTP 422 with a descriptive error message
3. THE Manual_Entry_Fallback SHALL validate barcode format client-side before submission and display an inline error for invalid input
