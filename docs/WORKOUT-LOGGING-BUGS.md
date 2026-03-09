# Workout Logging UI - Critical Bugs to Fix

## Issues Identified

### 1. Set Type Column Missing Header
**Problem:** SetTypeSelector shows in rows but no "Type" column header  
**Impact:** Users don't know what the badge means (N/W/D/A)  
**Fix:** Add "Type" column header before "Previous"

### 2. Column Alignment Off
**Problem:** Headers don't align with input fields  
**Impact:** Confusing, looks broken  
**Fix:** Adjust column widths to match

### 3. RPE Range Too Limited (6-10)
**Problem:** RPE picker only shows [6][7][8][9][10]  
**User wants:** [2][3][4][5][6][7][8][9][10]  
**Fix:** Change RPE_VALUES to start at 2

### 4. RPE Picker Doesn't Dismiss
**Problem:** Modal stays open after selection  
**Impact:** Can't continue logging  
**Fix:** Verify onSelect → handlePickerSelect → setPickerMode(null) chain

### 5. No Legend for Set Type Badges
**Problem:** Users don't know what N/W/D/A means  
**Impact:** Confusing UI  
**Fix:** Add tooltip or legend: N=Normal, W=Warm-up, D=Drop-set, A=AMRAP

---

## Implementation Plan

**Priority 1 (Blocking):**
- Fix RPE picker dismiss
- Fix RPE range (2-10)

**Priority 2 (UX):**
- Add Type column header
- Fix column alignment
- Add set type legend

