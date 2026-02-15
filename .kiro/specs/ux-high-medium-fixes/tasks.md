# HIGH + MEDIUM UX Fixes — Execution Plan

## Dependency Graph
```
Task 1 (password toggle)       → no deps
Task 2 (step counter)          → no deps
Task 3 (remove auto-advance)   → no deps
Task 4 (input chaining)        → no deps (same files as Task 1 but independent changes)
Task 5 (today button)          → no deps
Task 6 (empty states+cleanup)  → no deps
Task 7 (text helpers util)     → no deps
Task 8 (logs date filtering)   → no deps
Task 9 (rapid logging)         → no deps
Task 10 (learn search+favs)    → depends on Task 7 (stripMarkdown)
Task 11 (nutrition report)     → no deps
Task 12 (verification)         → depends on ALL
```

## Parallel Batches
- Batch A: Tasks 1-9 (all independent, parallelizable)
- Batch B: Tasks 10-11 (Task 10 depends on Task 7)
- Batch C: Task 12 (verification)

---

## BATCH A — Independent Tasks

### Task 1: Password Visibility Toggle on Auth Screens [frontend, 0 deps]
Files: `app/screens/auth/LoginScreen.tsx`, `app/screens/auth/RegisterScreen.tsx`

- [x] 1.1: In `LoginScreen.tsx`, add `const [showPassword, setShowPassword] = useState(false);`. On the password TextInput, change `secureTextEntry` to `secureTextEntry={!showPassword}`. Wrap the TextInput in a `<View style={{ position: 'relative' }}>` and add an absolute-positioned eye toggle: `<TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: spacing[3], top: spacing[3] }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.text.muted} /></TouchableOpacity>`. Import `Icon` from `../../components/common/Icon`. Add `paddingRight: spacing[10]` to the password input style to prevent text overlapping the icon.
- [x] 1.2: In `RegisterScreen.tsx`, add `const [showPassword, setShowPassword] = useState(false);` and `const [showConfirm, setShowConfirm] = useState(false);`. Apply the same eye toggle pattern to both password and confirm password fields. Use `showPassword` for the password field and `showConfirm` for the confirm field.
- [x] 1.3: Verify the Icon component supports 'eye' and 'eye-off' names. Read `app/components/common/Icon.tsx` and check the icon name map. If not supported, add them as simple SVG paths (open eye = circle with arc, closed eye = line through).
- [x] 1.4: Run `getDiagnostics` on both files. Zero errors.

Risk: Icon component may not have eye/eye-off icons. Mitigation: Task 1.3 checks and adds them if missing.
Rollback: Remove showPassword state, revert secureTextEntry to `true`, remove eye toggle elements.

### Task 2: Onboarding Step Counter [frontend, 0 deps]
Files: `app/screens/onboarding/OnboardingWizard.tsx`

- [x] 2.1: In `OnboardingWizard.tsx`, add a step counter text below the progress bar and above the back button. Inside the `progressContainer` View, after the progress track, add: `<Text style={styles.stepCounter}>Step {currentStep} of {TOTAL_STEPS}</Text>`. Add `stepCounter` to the StyleSheet: `{ color: colors.text.muted, fontSize: typography.size.xs, textAlign: 'right', marginTop: spacing[1] }`.
- [x] 2.2: Run `getDiagnostics` on OnboardingWizard.tsx. Zero errors.

Risk: None. Pure UI addition.
Rollback: Remove the Text element and style.

### Task 3: Remove IntentStep Auto-Advance [frontend, 0 deps]
Files: `app/screens/onboarding/steps/IntentStep.tsx`

- [x] 3.1: In `IntentStep.tsx`, change `handleSelect` to only update the store without auto-advancing: replace `const handleSelect = (type: GoalType) => { updateField('goalType', type); setTimeout(onNext, 200); };` with `const handleSelect = (type: GoalType) => { updateField('goalType', type); };`.
- [x] 3.2: Add a "Next" Button at the bottom of the ScrollView (before the skip link): `<Button title="Next" onPress={onNext} disabled={!goalType} style={{ marginTop: spacing[4] }} />`. Import `Button` from `../../../components/common/Button` (check if already imported).
- [x] 3.3: Run `getDiagnostics` on IntentStep.tsx. Zero errors.

Risk: Users who relied on auto-advance now need an extra tap. This is intentional — prevents accidental advancement.
Rollback: Restore `setTimeout(onNext, 200)` in handleSelect, remove the Next button.

### Task 4: Input Field Chaining on Auth Screens [frontend, 0 deps]
Files: `app/screens/auth/LoginScreen.tsx`, `app/screens/auth/RegisterScreen.tsx`

- [x] 4.1: In `LoginScreen.tsx`, add `const passwordRef = useRef<TextInput>(null);` (import `useRef` from React, `TextInput` type from react-native). On the email TextInput, add `returnKeyType="next"` and `onSubmitEditing={() => passwordRef.current?.focus()}`. On the password TextInput, add `ref={passwordRef}`, `returnKeyType="done"`, and `onSubmitEditing={handleLogin}`.
- [x] 4.2: In `RegisterScreen.tsx`, add refs: `const passwordRef = useRef<TextInput>(null);` and `const confirmRef = useRef<TextInput>(null);`. Email: `returnKeyType="next"`, `onSubmitEditing={() => passwordRef.current?.focus()}`. Password: `ref={passwordRef}`, `returnKeyType="next"`, `onSubmitEditing={() => confirmRef.current?.focus()}`. Confirm: `ref={confirmRef}`, `returnKeyType="done"`, `onSubmitEditing={handleRegister}`.
- [x] 4.3: Run `getDiagnostics` on both files. Zero errors.

Risk: `useRef<TextInput>` type may need explicit import. Mitigation: Import `TextInput` type from react-native (already imported for the component).
Rollback: Remove refs, remove returnKeyType and onSubmitEditing props.

### Task 5: DateScroller "Jump to Today" Button [frontend, 0 deps]
Files: `app/components/dashboard/DateScroller.tsx`

- [x] 5.1: In `DateScroller.tsx`, compute `const isToday = selectedDate === today;`. Add a conditional "Today" pill that renders when `!isToday`: place it above the ScrollView inside the container View. `{!isToday && (<TouchableOpacity onPress={() => { setWeekOffset(0); onDateSelect(today); }} style={styles.todayPill} activeOpacity={0.7}><Text style={styles.todayPillText}>↩ Today</Text></TouchableOpacity>)}`. Add styles: `todayPill: { alignSelf: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full, backgroundColor: colors.accent.primaryMuted, marginBottom: spacing[2] }`, `todayPillText: { color: colors.accent.primary, fontSize: typography.size.xs, fontWeight: typography.weight.semibold }`.
- [x] 5.2: Run `getDiagnostics` on DateScroller.tsx. Zero errors.

Risk: Resetting `weekOffset` to 0 may not scroll to the correct week if today is in a different week than the initial render. Mitigation: The `getReferenceDate` function uses `selectedDate` as the base, and setting `selectedDate` to today + `weekOffset` to 0 should recenter correctly.
Rollback: Remove the todayPill conditional block and styles.

### Task 6: Consistent Empty States + Remove Placeholder Buttons [frontend, 0 deps]
Files: `app/screens/coaching/CoachingScreen.tsx`, `app/screens/health/HealthReportsScreen.tsx`

- [x] 6.1: In `CoachingScreen.tsx`: Import `EmptyState` from `../../components/common/EmptyState` and `Icon` (if not already). Replace `<Text style={styles.empty}>No coaching requests yet</Text>` with `<EmptyState icon={<Icon name="target" />} title="No coaching requests" description="Submit a request to get started" />`. Replace `<Text style={styles.empty}>No coaching sessions yet</Text>` with `<EmptyState icon={<Icon name="calendar" />} title="No coaching sessions" description="Sessions will appear here after your request is reviewed" />`.
- [x] 6.2: In `CoachingScreen.tsx`: Remove the `<Button title="Upload Document" ...>` from each request card. Remove the `handleUploadDocument` function entirely. Remove the `uploadBtn` style.
- [x] 6.3: In `HealthReportsScreen.tsx`: Import `EmptyState` and `Icon`. Replace `<Text style={styles.empty}>No health reports yet</Text>` with `<EmptyState icon={<Icon name="chart" />} title="No health reports" description="Upload a blood report to see your health analysis" />`.
- [x] 6.4: In `HealthReportsScreen.tsx`: Change the "Upload New Report" Button to a disabled state. Replace `<Button title="Upload New Report" onPress={handleUpload} ...>` with `<Button title="Upload New Report" onPress={() => {}} disabled={true} style={styles.uploadBtn} />` and add a subtitle below it: `<Text style={{ color: colors.text.muted, fontSize: typography.size.xs, textAlign: 'center', marginBottom: spacing[2] }}>File upload coming soon</Text>`. Remove the `handleUpload` function.
- [x] 6.5: Run `getDiagnostics` on both files. Zero errors.

Risk: Removing upload buttons changes the UI contract. Mitigation: These buttons were non-functional (showed "coming soon" alerts), so removing them improves trust.
Rollback: Restore the Button components and handler functions.

### Task 7: Create Text Helper Utilities [frontend, 0 deps]
Files: `app/utils/textHelpers.ts` (NEW), `app/__tests__/utils/textHelpers.test.ts` (NEW)

- [x] 7.1: Create `app/utils/textHelpers.ts` exporting `stripMarkdown(text: string, maxLength: number = 120): string`. Implementation: remove markdown headers (`#`), bold/italic (`*`, `_`), links (`[text](url)` → `text`), code blocks, blockquotes (`>`), list markers (`-`, `*`, numbered). Trim whitespace. Truncate to `maxLength` chars with `...` suffix if longer.
- [x] 7.2: Create `app/__tests__/utils/textHelpers.test.ts` with tests: strips `# Heading` to `Heading`, strips `**bold**` to `bold`, strips `[link](url)` to `link`, preserves plain text, truncates long text with `...`, handles empty string, handles null/undefined gracefully.
- [x] 7.3: Run `cd app && npx jest __tests__/utils/textHelpers.test.ts` — all tests pass.

Risk: Regex-based markdown stripping won't handle all edge cases. Mitigation: Good enough for preview text — doesn't need to be perfect.
Rollback: Delete both files.

### Task 8: Logs Screen Date Filtering [frontend, 0 deps]
Files: `app/screens/logs/LogsScreen.tsx`

- [x] 8.1: In `LogsScreen.tsx`, read `selectedDate` from the store: `const selectedDate = useStore((s) => s.selectedDate);` and `const setSelectedDate = useStore((s) => s.setSelectedDate);` (already has `selectedDate` — verify it's used for filtering).
- [x] 8.2: Change `loadNutritionData` to filter by `selectedDate` instead of last 7 days: replace `const start = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];` with `const start = selectedDate;` and `const end = selectedDate;`. This shows only the selected day's entries.
- [x] 8.3: Add a compact date display at the top of the screen (after the tabs, before the list). Show the selected date with left/right arrows: `<View style={styles.dateNav}><TouchableOpacity onPress={() => changeDate(-1)}><Text style={styles.dateArrow}>‹</Text></TouchableOpacity><Text style={styles.dateText}>{formatDisplayDate(selectedDate)}</Text><TouchableOpacity onPress={() => changeDate(1)}><Text style={styles.dateArrow}>›</Text></TouchableOpacity></View>`. Add `changeDate` function: `const changeDate = (delta: number) => { const d = new Date(selectedDate + 'T12:00:00'); d.setDate(d.getDate() + delta); setSelectedDate(d.toISOString().split('T')[0]); };`. Add `formatDisplayDate`: `const formatDisplayDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });`. Add styles for `dateNav`, `dateArrow`, `dateText`.
- [x] 8.4: Add `selectedDate` to the dependency array of `loadNutritionData` useCallback and the `useEffect` that calls `loadData`, so data reloads when the date changes.
- [x] 8.5: Run `getDiagnostics` on LogsScreen.tsx. Zero errors.

Risk: Changing from 7-day view to single-day view is a behavior change. Users who liked seeing a week of entries will see less. Mitigation: The date arrows let them navigate quickly, and this matches the Dashboard's date-aware behavior.
Rollback: Revert to `Date.now() - 7 * 86400000` range, remove date nav UI.

### Task 9: Post-Save Rapid Logging in Nutrition Modal [frontend, 0 deps]
Files: `app/components/modals/AddNutritionModal.tsx`

- [x] 9.1: In `AddNutritionModal.tsx`, change the post-save flow. After `onSuccess()` in `handleSubmit`, instead of `setShowSaveAsFavorite(true)`, do: add a `successMessage` state (`const [successMessage, setSuccessMessage] = useState('');`). After `onSuccess()`, set `setSuccessMessage(\`\${calories} kcal logged ✓\`);`. Clear the form fields by calling a new `clearForm()` function (extract the field-clearing logic from `reset()` but don't close the modal). Auto-hide the success message after 2 seconds: `setTimeout(() => setSuccessMessage(''), 2000);`.
- [x] 9.2: Add a small "Save as Favorite" text link that appears when `successMessage` is visible: `{successMessage && (<View style={styles.successRow}><Text style={styles.successText}>{successMessage}</Text><TouchableOpacity onPress={handleSaveAsFavorite}><Text style={styles.saveFavLink}>Save as Favorite</Text></TouchableOpacity></View>)}`. Place this above the form fields.
- [x] 9.3: Add a "Done" button at the bottom of the modal (below the submit button) that closes the modal: `<TouchableOpacity onPress={handleCloseAfterSave} style={styles.doneBtn}><Text style={styles.doneBtnText}>Done</Text></TouchableOpacity>`. This replaces the old full-screen "Save as Favorite" prompt.
- [x] 9.4: Remove or simplify the `showSaveAsFavorite` full-screen state. The early return `if (showSaveAsFavorite) { return (...) }` block can be removed entirely since the inline success message replaces it.
- [x] 9.5: Run `getDiagnostics` on AddNutritionModal.tsx. Zero errors.

Risk: This is a significant refactor of a 1800-line file. Mitigation: Only changing the post-save flow, not the form logic. The `handleSubmit` function's core logic stays the same.
Rollback: Restore the `showSaveAsFavorite` early return block and remove the inline success message.

---

## ═══ CHECKPOINT A ═══
Gate criteria before proceeding to Batch B:
- [ ] `getDiagnostics` on LoginScreen.tsx, RegisterScreen.tsx — zero errors
- [ ] `getDiagnostics` on OnboardingWizard.tsx, IntentStep.tsx — zero errors
- [ ] `getDiagnostics` on DateScroller.tsx — zero errors
- [ ] `getDiagnostics` on CoachingScreen.tsx, HealthReportsScreen.tsx — zero errors
- [ ] `getDiagnostics` on LogsScreen.tsx — zero errors
- [ ] `getDiagnostics` on AddNutritionModal.tsx — zero errors
- [ ] `cd app && npx jest __tests__/utils/textHelpers.test.ts` — all tests pass

---

## BATCH B — Dependent Tasks

### Task 10: Learn Screen — Search, Favorites Filter, Article Preview [frontend, depends on Task 7]
Files: `app/screens/learn/LearnScreen.tsx`

- [x] 10.1: Import `stripMarkdown` from `../../utils/textHelpers`. Add search state: `const [searchQuery, setSearchQuery] = useState('');`. Add a TextInput above the filter pills FlatList: `<TextInput style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} placeholder="Search articles..." placeholderTextColor={colors.text.muted} testID="learn-search-input" />`. Add `searchInput` style matching the app's input pattern.
- [x] 10.2: Update `loadArticles` to pass search query: add `if (searchQuery.trim()) params.q = searchQuery.trim();` before the API call. Add `searchQuery` to the `useCallback` dependency array. Debounce: wrap the search in a 300ms debounce (use a `useRef` timer pattern like AddNutritionModal's search).
- [x] 10.3: Add "Favorites" to the filter options. Change `CATEGORIES` to `const CATEGORIES = ['All', '★ Favorites', 'Nutrition', 'Training', 'Recovery', 'Mindset'];`. When `category === '★ Favorites'`, filter articles client-side: `const displayArticles = category === '★ Favorites' ? articles.filter(a => favorites.has(a.id)) : articles;`. Use `displayArticles` in the FlatList data prop instead of `articles`.
- [x] 10.4: Add article preview text to `AnimatedArticleCard`. The Article interface needs a `content_markdown?: string` field (add it). In the card, after the title Text, add: `{item.content_markdown && (<Text style={styles.articlePreview} numberOfLines={2}>{stripMarkdown(item.content_markdown)}</Text>)}`. Add `articlePreview` style: `{ color: colors.text.secondary, fontSize: typography.size.sm, marginTop: spacing[1], lineHeight: typography.size.sm * typography.lineHeight.normal }`. Note: the API may not return `content_markdown` in list responses — if not, this gracefully shows nothing (existing behavior).
- [x] 10.5: Run `getDiagnostics` on LearnScreen.tsx. Zero errors.

Risk: Adding search + favorites filter + preview in one task is a lot of changes to one file. Mitigation: Each change is independent within the file — search is a new input, favorites is a filter condition, preview is a new Text element.
Rollback: Remove search input, revert CATEGORIES, remove preview Text, remove stripMarkdown import.

### Task 11: Nutrition Report — Read Age/Sex from Store [frontend, 0 deps]
Files: `app/screens/nutrition/NutritionReportScreen.tsx`

- [x] 11.1: Import `useOnboardingStore, computeAge` from `../../store/onboardingSlice`. At the top of the component, read: `const birthYear = useOnboardingStore((s) => s.birthYear);`, `const birthMonth = useOnboardingStore((s) => s.birthMonth);`, `const sex = useOnboardingStore((s) => s.sex);`.
- [x] 11.2: Replace the hardcoded `const userAge: number = 30;` with `const userAge: number = birthYear ? computeAge(birthYear, birthMonth) : 30;`. Replace `const userSex: Sex = 'male';` with `const userSex: Sex = (sex as Sex) || 'male';`.
- [x] 11.3: Update `profileIncomplete` to be conditional: `const profileIncomplete = !birthYear || !sex;`. This hides the warning banner when real data is available.
- [x] 11.4: Run `getDiagnostics` on NutritionReportScreen.tsx. Zero errors.

Risk: `useOnboardingStore` may not persist data after onboarding completes (it calls `reset()`). Mitigation: Check if the onboarding store persists to AsyncStorage. If it resets, the fallback defaults still work. This is a best-effort improvement — the warning banner handles the fallback case.
Rollback: Revert to hardcoded age=30, sex='male', profileIncomplete=true.

---

## ═══ CHECKPOINT B ═══
Gate criteria before proceeding to verification:
- [ ] `getDiagnostics` on LearnScreen.tsx — zero errors
- [ ] `getDiagnostics` on NutritionReportScreen.tsx — zero errors
- [ ] `cd app && npx jest --passWithNoTests` — all frontend tests pass (no regressions)

---

## BATCH C — Verification

### Task 12: Final Verification [all]

- [x] 12.1: Run `getDiagnostics` on ALL modified files (list): LoginScreen.tsx, RegisterScreen.tsx, OnboardingWizard.tsx, IntentStep.tsx, DateScroller.tsx, CoachingScreen.tsx, HealthReportsScreen.tsx, LogsScreen.tsx, AddNutritionModal.tsx, LearnScreen.tsx, NutritionReportScreen.tsx. All must show zero errors.
- [x] 12.2: Run `cd app && npx jest --passWithNoTests` — full frontend test suite passes.
- [x] 12.3: Run `source .venv/bin/activate && python -m pytest tests/ -x --timeout=60` — full backend test suite passes.
- [x] 12.4: Run existing Playwright E2E suite: `cd app && npx playwright test --reporter=list` — all 67+ tests pass (no regressions from UI changes).

---

## Rollback Plan Summary

| Task | Rollback Action |
|------|----------------|
| 1 | Remove showPassword state, eye toggle elements from auth screens |
| 2 | Remove step counter Text from OnboardingWizard |
| 3 | Restore setTimeout auto-advance in IntentStep, remove Next button |
| 4 | Remove refs, returnKeyType, onSubmitEditing from auth screens |
| 5 | Remove todayPill conditional and styles from DateScroller |
| 6 | Restore upload buttons and plain text empty states |
| 7 | Delete textHelpers.ts and test file |
| 8 | Revert LogsScreen to 7-day range, remove date nav |
| 9 | Restore showSaveAsFavorite full-screen flow in AddNutritionModal |
| 10 | Remove search, favorites filter, preview from LearnScreen |
| 11 | Revert NutritionReportScreen to hardcoded age/sex defaults |

Each task is independently rollbackable. No database migrations or schema changes.
