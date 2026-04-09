# Bug Fixes Plan — Round 3

## Phase 1: Critical Crashes & Errors

### 1. Volume tab crash — "cannot destructure property MV of landmarks"
- **Root cause**: `VolumeBar.tsx:44` does `const { mv, mev, mav_high, mrv } = landmarks` — crashes when API returns entry without landmarks
- **Fix**: Add null guard: `const { mv = 0, mev = 0, mav_high = 0, mrv = 0 } = landmarks ?? {};`
- **Also**: Filter entries with missing landmarks in AnalyticsScreen

### 2. Dietary gaps 500 error (`/dietary/gaps?window_days=14`)
- **Root cause**: No error handling in router, likely `micro_nutrients` JSONB containing non-dict data
- **Fix**: Add try/except in router + defensive check for `micro_nutrients` type in service

### 3. Nutrition modal X button not closing (when empty)
- **Root cause**: Investigation shows handleClose SHOULD work when empty. Need to verify the `onClose` prop is correctly passed and the modal `visible` state is toggled.
- **Fix**: Check if the issue is in the parent component not toggling `visible` state

## Phase 2: Color Corrections

### 4. Macro ring colors — wrong mapping
- **User wants**: protein=green, carbs=yellow, fat=red, calories=blue
- **Current**: protein=blue, carbs=amber, fat=green, calories=red
- **Fix**: Update `tokens.ts` and `lightColors.ts` macro colors + gradientArrays
- **Also**: Ensure gradient fills match the solid colors (light green fills green ring, etc.)

### 5. Ring gradient fill color — orange instead of matching color
- **Root cause**: All gradients trend toward orange (`#F97316`). Need each gradient to be a lighter shade of its own color.
- **Fix**: Update gradientArrays to use same-hue gradients

## Phase 3: Layout & Alignment

### 6. Charts left-aligned / not filling panel
- **Root cause**: `TrendLineChart.tsx:10` uses `Dimensions.get('window').width` — static, computed once at module load. Not responsive.
- **Fix**: Replace with `useWindowDimensions()` hook or `onLayout` measurement inside the component

### 7. Streak indicator + macro rings alignment
- **Root cause**: No explicit width constraints, relies on parent flex
- **Fix**: Ensure consistent padding and centering

## Phase 4: Polish

### 8. Subscription expiry date
- **Already implemented**: Shows "Renews" date when `currentPeriodEnd` exists. No change needed.

### 9. Bottom bar lightning / Pro badge
- **Not found in code**: No lightning icon or Pro badge exists in BottomTabNavigator. May be a browser extension or OS-level overlay. No change needed.

### 10. Muscle volume heatmap — better body diagram
- **Research needed**: Investigate libraries for premium body silhouette (react-native-svg based, or a pre-made anatomical SVG)
- **Defer**: This is a design overhaul, not a bug fix
