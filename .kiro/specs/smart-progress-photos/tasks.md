# Implementation Plan: Smart Progress Photos Enhancement

## Overview

Layered implementation starting with backend schema changes, then frontend pure utility functions (testable in isolation), then UI components, then wiring into the existing screen. Each phase has a testing checkpoint before proceeding.

## Tasks

- [x] 1. Backend schema expansion and migration
  - [x] 1.1 Update ProgressPhoto model with alignment_data column and expanded pose_type
    - Add `alignment_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)` to `src/modules/progress_photos/models.py`
    - Widen `pose_type` column from `String(20)` to `String(30)`
    - _Requirements: 4.1, 6.3_

  - [x] 1.2 Update Pydantic schemas for expanded pose types and alignment data
    - Add `AlignmentData` model to `src/modules/progress_photos/schemas.py` with `centerX`, `centerY` (0-1 float), `scale` (>0 float)
    - Update `PhotoCreate.pose_type` regex to `^(front_relaxed|front_double_bicep|side|back)$` with default `front_relaxed`
    - Add `alignment_data: AlignmentData | None` to `PhotoCreate` and `PhotoResponse`
    - Add `PhotoUpdate` schema with optional `alignment_data` field
    - _Requirements: 4.1, 4.3, 6.3, 7.1_

  - [x] 1.3 Create Alembic migration for pose_type expansion and alignment_data column
    - Add `alignment_data` JSON column (nullable)
    - Data migration: UPDATE `pose_type` SET `front_relaxed` WHERE `pose_type` = `front`
    - Widen `pose_type` column to String(30)
    - Verify downgrade path reverses both changes
    - _Requirements: 4.1, 4.2_

  - [x] 1.4 Add PATCH endpoint for alignment_data updates
    - Add `PATCH /{photo_id}` to `src/modules/progress_photos/router.py`
    - Add `update_photo` method to `src/modules/progress_photos/service.py` that updates only `alignment_data`
    - Scope to authenticated user (existing `get_current_user` dependency)
    - _Requirements: 6.3, 6.5_

  - [ ]* 1.5 Write property tests for backend schema changes
    - **Property 5: Pose type validation** — For any string, PhotoCreate accepts iff it's one of the four valid pose types
    - **Validates: Requirements 4.1, 4.3**
    - **Property 1: Selected pose type persists in metadata** — For any valid pose type, creating a photo stores that exact value
    - **Validates: Requirements 1.2**
    - **Property 11: Photo metadata serialization round-trip** — For any valid PhotoResponse (with optional AlignmentData), serialize then deserialize produces equivalent object
    - **Validates: Requirements 7.3**

  - [ ]* 1.6 Write unit tests for backend edge cases
    - Test legacy "front" → "front_relaxed" equivalence after migration
    - Test PATCH returns 404 for non-existent photo_id
    - Test PATCH returns 422 for invalid alignment_data (centerX > 1.0, scale <= 0)
    - Test PhotoCreate defaults to front_relaxed when pose_type omitted
    - _Requirements: 4.2, 1.3, 6.3_

- [x] 2. Checkpoint — Backend green
  - Ensure all backend tests pass (existing + new property tests P1, P5, P11 + unit tests)
  - Verify migration up and down works: `alembic upgrade head` then `alembic downgrade -1`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Frontend pure utility functions
  - [x] 3.1 Create shared types and constants
    - Create `app/utils/progressPhotoTypes.ts` with `PoseType` union type, `AlignmentData` interface, `ImageTransform` interface, `POSE_TYPES` array constant
    - _Requirements: 1.2, 4.1_

  - [x] 3.2 Implement pose overlay utility functions
    - Create `app/utils/poseOverlayLogic.ts`
    - `poseToAssetPath(poseType: PoseType): string` — maps pose type to SVG asset require path
    - `computeOverlayDimensions(containerWidth, containerHeight, assetAspectRatio): {width, height}` — scales maintaining aspect ratio
    - _Requirements: 2.1, 2.4_

  - [x] 3.3 Implement timeline utility functions
    - Create `app/utils/timelineLogic.ts`
    - `sortPhotosByDate(photos: PhotoMeta[]): PhotoMeta[]` — ascending by capture_date, stable sort
    - `filterByPoseType(photos: PhotoMeta[], filter: PoseType | 'all'): PhotoMeta[]` — returns matching subset
    - `formatPhotoInfo(photo: PhotoMeta): {dateLabel: string, weightLabel: string | null}` — formats display strings
    - _Requirements: 5.1, 5.3, 5.5_

  - [x] 3.4 Implement auto-alignment utility functions
    - Create `app/utils/autoAlignLogic.ts`
    - `alignForComparison(left: AlignmentData, right: AlignmentData): {leftTransform: ImageTransform, rightTransform: ImageTransform}` — pure function that computes center-alignment and scale-matching transforms
    - `computeAlignment(imageUri: string): Promise<AlignmentData>` — analyzes image to find body center and scale using expo-image-manipulator thumbnail + pixel analysis
    - _Requirements: 6.1, 6.2_

  - [x] 3.5 Implement lighting reminder preference logic
    - Create `app/utils/lightingReminderLogic.ts`
    - `getLightingReminderDismissed(): Promise<boolean>` — reads from AsyncStorage
    - `setLightingReminderDismissed(value: boolean): Promise<void>` — writes to AsyncStorage
    - `shouldShowReminder(): Promise<boolean>` — returns true if not dismissed
    - _Requirements: 3.4, 3.5_

  - [ ]* 3.6 Write property tests for frontend utility functions
    - **Property 2: Pose type maps to correct overlay asset** — For any valid PoseType, poseToAssetPath returns a unique asset path
    - **Validates: Requirements 2.1**
    - **Property 3: Overlay scales proportionally** — For any container dimensions, computeOverlayDimensions maintains aspect ratio
    - **Validates: Requirements 2.4**
    - **Property 6: Timeline chronological ordering** — For any photo array, sortPhotosByDate returns ascending order
    - **Validates: Requirements 5.1**
    - **Property 7: Photo info display completeness** — For any PhotoMeta, formatPhotoInfo output contains date and weight when present
    - **Validates: Requirements 5.3**
    - **Property 8: Pose type filter correctness** — For any photo array and filter, result contains exactly the matching photos
    - **Validates: Requirements 5.5**
    - **Property 9: Auto-alignment transform correctness** — For any two AlignmentData, alignForComparison produces equal effective centers and scales
    - **Validates: Requirements 6.1, 6.2**
    - **Property 4: Lighting reminder preference round-trip** — For any boolean, write then read returns same value
    - **Validates: Requirements 3.4, 3.5**

  - [ ]* 3.7 Write unit tests for frontend utility edge cases
    - Test empty photo array in sortPhotosByDate returns empty array
    - Test single photo in sortPhotosByDate returns same array
    - Test filterByPoseType with 'all' returns full array
    - Test formatPhotoInfo with null bodyweight_kg returns null weightLabel
    - Test alignForComparison with identical AlignmentData produces identity transforms
    - Test computeOverlayDimensions with zero dimensions returns zero
    - _Requirements: 5.1, 5.3, 5.5, 6.1_

- [x] 4. Checkpoint — Frontend utils green
  - Ensure all fast-check property tests pass (P2, P3, P4, P6, P7, P8, P9)
  - Ensure all unit tests pass
  - Ensure no TypeScript errors in new utility files
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Frontend UI components
  - [x] 5.1 Create pose overlay SVG assets and PoseOverlay component
    - Add placeholder SVG files in `app/assets/pose-overlays/` (front-relaxed.svg, front-double-bicep.svg, side.svg, back.svg)
    - Create `app/components/photos/PoseOverlay.tsx` — renders SVG at 30% opacity, uses computeOverlayDimensions for sizing
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 5.2 Create PoseSelector component
    - Create `app/components/photos/PoseSelector.tsx` — modal/bottom-sheet with four tappable pose cards showing silhouette thumbnails
    - Calls `onSelect(poseType)` on tap, `onCancel()` on dismiss
    - _Requirements: 1.1, 1.2_

  - [x] 5.3 Create LightingReminder component
    - Create `app/components/photos/LightingReminder.tsx` — dismissible card with lighting guidance text
    - Includes "Don't show again" toggle that calls setLightingReminderDismissed(true)
    - Uses shouldShowReminder() to auto-skip when preference is set
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 5.4 Create GuidedCameraView component
    - Create `app/components/photos/GuidedCameraView.tsx` — wraps expo-camera with PoseOverlay layer
    - Accepts poseType prop, renders PoseOverlay on top of camera preview
    - Handles capture and returns photo URI via onCapture callback
    - _Requirements: 2.1, 2.3_

  - [x] 5.5 Create TimelineSlider component
    - Create `app/components/photos/TimelineSlider.tsx` — horizontal FlatList with snap-to-item behavior
    - Uses sortPhotosByDate and filterByPoseType from utility functions
    - Displays formatPhotoInfo below each photo
    - Includes pose type filter pills at top
    - Detects pinch gesture via PinchGestureHandler to trigger comparison mode
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 5.6 Create enhanced ComparisonView with auto-alignment
    - Create `app/components/photos/AlignedComparison.tsx` — replaces old PhotoComparison for comparison mode
    - Calls computeAlignment for photos missing alignment_data, then PATCHes result to backend
    - Uses alignForComparison to compute transforms, applies via React Native transform styles
    - Falls back to center-aligned when alignment_data is null (body not detected)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 6. Wire components into ProgressPhotosScreen
  - [x] 6.1 Refactor ProgressPhotosScreen capture flow
    - Replace `showCaptureOptions` with new flow: FAB tap → PoseSelector → LightingReminder → GuidedCameraView
    - Pass selected poseType to API POST call (replacing hardcoded 'front')
    - Handle "Don't show again" preference for LightingReminder
    - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.3, 3.4_

  - [x] 6.2 Replace photo grid with TimelineSlider
    - Remove existing FlatList grid rendering
    - Mount TimelineSlider with photos, pathMap, and pose filter state
    - Wire pinch-to-compare to show AlignedComparison overlay
    - _Requirements: 5.1, 5.2, 5.5_

  - [x] 6.3 Integrate AlignedComparison into comparison mode
    - When comparison mode is triggered (pinch or explicit action), render AlignedComparison with two selected photos
    - Pass pathMap for local file URIs
    - Handle back/dismiss to return to timeline view
    - _Requirements: 6.1, 6.2, 6.4_

  - [ ]* 6.4 Write component tests for new UI components
    - Test PoseSelector renders all four pose options
    - Test LightingReminder displays required guidance text
    - Test LightingReminder respects "Don't show again" preference
    - Test TimelineSlider renders photos in chronological order
    - Test AlignedComparison applies transforms from alignForComparison
    - Test AlignedComparison falls back to center-aligned when alignment_data is null
    - _Requirements: 1.1, 3.2, 3.4, 5.1, 6.1, 6.4_

- [x] 7. Final checkpoint — All green
  - Run full backend test suite: `pytest tests/`
  - Run full frontend test suite: `npx jest --run`
  - Verify no TypeScript errors: `npx tsc --noEmit`
  - Verify no regressions in existing progress photo tests
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation — do not proceed past a checkpoint with failing tests
- Property tests validate universal correctness properties (fast-check + Hypothesis)
- Unit tests validate specific examples and edge cases
- Backend changes are fully independent of frontend — can be deployed separately
- Feature flag `smart_progress_photos_enabled` recommended for production rollout (not implemented in this plan — operational concern)
