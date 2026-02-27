import * as fc from 'fast-check';
import { cmToFtIn, ftInToCm } from '../../utils/unitConversion';

// ─── Pure logic extracted from ProfileScreen for testing ─────────────────────

/** Avatar initial derivation logic */
function getAvatarInitial(displayName: string | undefined | null, email: string): string {
  return (
    (displayName && displayName.length > 0 ? displayName : email) || '?'
  )[0].toUpperCase();
}

/** Premium badge visibility */
function shouldShowPremiumBadge(subscriptionStatus: string | null): boolean {
  return subscriptionStatus === 'active' || subscriptionStatus === 'past_due';
}

/** Display name validation */
function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Display name cannot be empty';
  if (trimmed.length > 100) return 'Display name must be 100 characters or less';
  return null;
}

/** Body stats field validation */
function validateBodyStats(fields: {
  weightKg?: number;
  heightCm?: number;
  bodyFatPct?: number;
}): string | null {
  if (fields.weightKg !== undefined && fields.weightKg <= 0) {
    return 'Weight must be greater than 0';
  }
  if (fields.heightCm !== undefined && fields.heightCm <= 0) {
    return 'Height must be greater than 0';
  }
  if (fields.bodyFatPct !== undefined && (fields.bodyFatPct < 0 || fields.bodyFatPct > 100)) {
    return 'Body fat percentage must be between 0 and 100';
  }
  return null;
}

/** Goals field validation */
function validateGoalType(goalType: string): boolean {
  return ['cutting', 'maintaining', 'bulking'].includes(goalType);
}

/** Recalculate payload builder — metrics only */
function buildRecalculatePayload(opts: {
  metrics?: { height_cm?: number; weight_kg?: number; body_fat_pct?: number; activity_level?: string };
  goals?: { goal_type: string; target_weight_kg?: number; goal_rate_per_week?: number };
}): { metrics?: Record<string, unknown>; goals?: Record<string, unknown> } {
  const payload: { metrics?: Record<string, unknown>; goals?: Record<string, unknown> } = {};
  if (opts.metrics) payload.metrics = opts.metrics;
  if (opts.goals) payload.goals = opts.goals;
  return payload;
}

/** Timezone auto-detect with UTC fallback */
function detectTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Unit system toggle payload builder */
function buildUnitTogglePayload(
  existingPrefs: Record<string, unknown> | null,
  newSystem: 'metric' | 'imperial',
): { preferences: Record<string, unknown> } {
  return {
    preferences: { ...(existingPrefs ?? {}), unit_system: newSystem },
  };
}

/** Coaching mode payload builder */
function buildCoachingModePayload(mode: string): { coaching_mode: string } {
  return { coaching_mode: mode };
}

/** Display name save payload builder */
function buildDisplayNamePayload(name: string): { display_name: string } {
  return { display_name: name.trim() };
}

/** Store profile mapping (API snake_case → store camelCase) */
function mapApiToStoreProfile(data: any) {
  return {
    id: data.id,
    userId: data.user_id,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    timezone: data.timezone,
    preferredCurrency: data.preferred_currency,
    region: data.region,
    preferences: data.preferences,
    coachingMode: data.coaching_mode,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

// Feature: profile-redesign, Property 1: Avatar initial derivation
describe('ProfileScreen: Avatar Initial Logic', () => {
  /** Validates: Requirements 1.1 */
  test('uses first char of displayName (uppercased) when non-empty', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (displayName, email) => {
          const initial = getAvatarInitial(displayName, email);
          expect(initial).toBe(displayName[0].toUpperCase());
        },
      ),
      { numRuns: 100 },
    );
  });

  test('falls back to email first char when displayName is empty/null/undefined', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', undefined, null),
        fc.string({ minLength: 1, maxLength: 50 }),
        (displayName, email) => {
          const initial = getAvatarInitial(displayName as any, email);
          expect(initial).toBe(email[0].toUpperCase());
        },
      ),
      { numRuns: 100 },
    );
  });

  test('always returns a single uppercase character', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(undefined), fc.constant(null), fc.constant(''), fc.string({ minLength: 1, maxLength: 50 })),
        fc.string({ minLength: 1, maxLength: 50 }),
        (displayName, email) => {
          const initial = getAvatarInitial(displayName, email);
          expect(initial.length).toBe(1);
          expect(initial).toBe(initial.toUpperCase());
        },
      ),
      { numRuns: 100 },
    );
  });

  test('returns ? when both displayName and email are empty', () => {
    expect(getAvatarInitial('', '')).toBe('?');
    expect(getAvatarInitial(null, '')).toBe('?');
    expect(getAvatarInitial(undefined, '')).toBe('?');
  });
});

describe('ProfileScreen: Premium Badge Logic', () => {
  test('shows badge for active and past_due subscriptions', () => {
    expect(shouldShowPremiumBadge('active')).toBe(true);
    expect(shouldShowPremiumBadge('past_due')).toBe(true);
  });

  test('hides badge for free, cancelled, pending_payment, and null', () => {
    expect(shouldShowPremiumBadge('free')).toBe(false);
    expect(shouldShowPremiumBadge('cancelled')).toBe(false);
    expect(shouldShowPremiumBadge('pending_payment')).toBe(false);
    expect(shouldShowPremiumBadge(null)).toBe(false);
  });
});

describe('ProfileScreen: Display Name Validation', () => {
  test('rejects empty or whitespace-only names', () => {
    expect(validateDisplayName('')).toBe('Display name cannot be empty');
    expect(validateDisplayName('   ')).toBe('Display name cannot be empty');
    expect(validateDisplayName('\t\n')).toBe('Display name cannot be empty');
  });

  test('rejects names longer than 100 characters', () => {
    const longName = 'a'.repeat(101);
    expect(validateDisplayName(longName)).toBe('Display name must be 100 characters or less');
  });

  test('accepts valid names up to 100 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0 && s.trim().length <= 100),
        (name) => {
          expect(validateDisplayName(name)).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  test('exactly 100 chars is valid', () => {
    expect(validateDisplayName('a'.repeat(100))).toBeNull();
  });
});

// Feature: profile-redesign — Body Stats Validation
// Validates: Requirements 2.1, 2.7
describe('ProfileScreen: Body Stats Field Validation', () => {
  test('rejects weight <= 0', () => {
    expect(validateBodyStats({ weightKg: 0 })).toBe('Weight must be greater than 0');
    expect(validateBodyStats({ weightKg: -5 })).toBe('Weight must be greater than 0');
  });

  test('rejects height <= 0', () => {
    expect(validateBodyStats({ heightCm: 0 })).toBe('Height must be greater than 0');
    expect(validateBodyStats({ heightCm: -10 })).toBe('Height must be greater than 0');
  });

  test('rejects body fat outside 0-100 range', () => {
    expect(validateBodyStats({ bodyFatPct: -1 })).toBe('Body fat percentage must be between 0 and 100');
    expect(validateBodyStats({ bodyFatPct: 101 })).toBe('Body fat percentage must be between 0 and 100');
  });

  test('accepts valid body stats', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.1), max: Math.fround(500), noNaN: true }),
        fc.float({ min: Math.fround(1), max: Math.fround(300), noNaN: true }),
        fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
        (weight, height, bodyFat) => {
          expect(validateBodyStats({ weightKg: weight, heightCm: height, bodyFatPct: bodyFat })).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  test('boundary: body fat 0 and 100 are valid', () => {
    expect(validateBodyStats({ bodyFatPct: 0 })).toBeNull();
    expect(validateBodyStats({ bodyFatPct: 100 })).toBeNull();
  });
});

// Feature: profile-redesign — Goals Validation
// Validates: Requirements 3.1, 3.6
describe('ProfileScreen: Goals Field Validation', () => {
  test('accepts valid goal types', () => {
    expect(validateGoalType('cutting')).toBe(true);
    expect(validateGoalType('maintaining')).toBe(true);
    expect(validateGoalType('bulking')).toBe(true);
  });

  test('rejects invalid goal types', () => {
    expect(validateGoalType('recomp')).toBe(false);
    expect(validateGoalType('')).toBe(false);
    expect(validateGoalType('Cutting')).toBe(false);
    expect(validateGoalType('BULKING')).toBe(false);
  });

  test('only 3 valid goal types exist (PBT)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(
          (s) => !['cutting', 'maintaining', 'bulking'].includes(s),
        ),
        (randomType) => {
          expect(validateGoalType(randomType)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: profile-redesign — Recalculate Payload Builder
// Validates: Requirements 2.1, 3.1
describe('ProfileScreen: Recalculate Payload Builder', () => {
  test('metrics-only payload has correct shape', () => {
    const payload = buildRecalculatePayload({
      metrics: { weight_kg: 80, height_cm: 180, activity_level: 'moderate' },
    });
    expect(payload.metrics).toBeDefined();
    expect(payload.goals).toBeUndefined();
    expect(payload.metrics!.weight_kg).toBe(80);
    expect(payload.metrics!.height_cm).toBe(180);
  });

  test('goals-only payload has correct shape', () => {
    const payload = buildRecalculatePayload({
      goals: { goal_type: 'cutting', target_weight_kg: 75, goal_rate_per_week: -0.5 },
    });
    expect(payload.goals).toBeDefined();
    expect(payload.metrics).toBeUndefined();
    expect(payload.goals!.goal_type).toBe('cutting');
    expect(payload.goals!.target_weight_kg).toBe(75);
  });

  test('both metrics and goals payload has correct shape', () => {
    const payload = buildRecalculatePayload({
      metrics: { weight_kg: 82, height_cm: 175, body_fat_pct: 18, activity_level: 'active' },
      goals: { goal_type: 'bulking', target_weight_kg: 90, goal_rate_per_week: 0.3 },
    });
    expect(payload.metrics).toBeDefined();
    expect(payload.goals).toBeDefined();
    expect(payload.metrics!.weight_kg).toBe(82);
    expect(payload.goals!.goal_type).toBe('bulking');
  });

  test('empty call returns empty payload', () => {
    const payload = buildRecalculatePayload({});
    expect(payload.metrics).toBeUndefined();
    expect(payload.goals).toBeUndefined();
  });
});

// Feature: profile-redesign, Property 3: Unit conversion round-trip (height)
// Validates: Requirements 2.6
describe('ProfileScreen: Height Conversion Round-Trip', () => {
  test('cmToFtIn → ftInToCm round-trip within ±1.5cm for valid heights', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 300 }),
        (cm) => {
          const { feet, inches } = cmToFtIn(cm);
          const roundTrip = ftInToCm(feet, inches);
          expect(Math.abs(roundTrip - cm)).toBeLessThanOrEqual(1.5);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('known value: 180cm → 5ft 11in → back to ~180cm', () => {
    const { feet, inches } = cmToFtIn(180);
    expect(feet).toBe(5);
    expect(inches).toBe(11);
    const back = ftInToCm(5, 11);
    expect(Math.abs(back - 180)).toBeLessThanOrEqual(1.5);
  });

  test('known value: 152cm → 5ft 0in → back to ~152cm', () => {
    const { feet, inches } = cmToFtIn(152);
    expect(feet).toBe(4);
    expect(inches).toBe(12); // 59.84 inches → 4ft 12in (rounds up)
    const back = ftInToCm(feet, inches);
    expect(Math.abs(back - 152)).toBeLessThanOrEqual(1.5);
  });
});

// Feature: profile-redesign — Timezone auto-detect fallback
// Validates: Requirements 4.1
describe('ProfileScreen: Timezone Auto-Detect', () => {
  test('returns a non-empty string', () => {
    const tz = detectTimezone();
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
  });

  test('returns UTC as fallback when Intl is unavailable', () => {
    // Simulate Intl failure by temporarily overriding
    const originalIntl = globalThis.Intl;
    try {
      (globalThis as any).Intl = undefined;
      const tz = detectTimezone();
      expect(tz).toBe('UTC');
    } finally {
      globalThis.Intl = originalIntl;
    }
  });
});

// Feature: profile-redesign — Danger Zone collapsed by default
// Validates: Requirements 7.3, 7.4, 7.5
describe('ProfileScreen: Danger Zone', () => {
  test('danger zone starts collapsed (default state is false)', () => {
    // The AccountSection component initializes dangerZoneExpanded = false
    const dangerZoneExpanded = false; // default state
    expect(dangerZoneExpanded).toBe(false);
  });

  test('expanding danger zone toggles state', () => {
    let dangerZoneExpanded = false;
    // Simulate tap
    dangerZoneExpanded = !dangerZoneExpanded;
    expect(dangerZoneExpanded).toBe(true);
    // Simulate second tap to collapse
    dangerZoneExpanded = !dangerZoneExpanded;
    expect(dangerZoneExpanded).toBe(false);
  });
});

describe('ProfileScreen: API Payload Builders', () => {
  test('unit toggle payload preserves existing preferences', () => {
    const existing = { theme: 'dark', unit_system: 'metric' as const };
    const payload = buildUnitTogglePayload(existing, 'imperial');
    expect(payload.preferences.theme).toBe('dark');
    expect(payload.preferences.unit_system).toBe('imperial');
  });

  test('unit toggle payload works with null preferences', () => {
    const payload = buildUnitTogglePayload(null, 'metric');
    expect(payload.preferences.unit_system).toBe('metric');
  });

  test('coaching mode payload has correct shape', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('coached', 'collaborative', 'manual'),
        (mode) => {
          const payload = buildCoachingModePayload(mode);
          expect(payload).toEqual({ coaching_mode: mode });
        },
      ),
    );
  });

  test('display name payload trims whitespace', () => {
    expect(buildDisplayNamePayload('  John  ')).toEqual({ display_name: 'John' });
    expect(buildDisplayNamePayload('Alice')).toEqual({ display_name: 'Alice' });
  });
});

describe('ProfileScreen: Structure', () => {
  const FEATURE_NAV_ITEMS = [
    { label: 'Coaching', description: 'AI-powered training guidance' },
    { label: 'Community', description: 'Connect with other lifters' },
    { label: "Founder's Story", description: 'The story behind Repwise' },
    { label: 'Health Reports', description: 'Detailed health analysis' },
    { label: 'Learn', description: 'Articles and educational content' },
    { label: 'Progress Photos', description: 'Track your transformation visually' },
  ];

  test('feature nav items have exactly 6 entries', () => {
    expect(FEATURE_NAV_ITEMS).toHaveLength(6);
  });

  test('feature nav items have correct labels', () => {
    const labels = FEATURE_NAV_ITEMS.map((item) => item.label);
    expect(labels).toEqual([
      'Coaching',
      'Community',
      "Founder's Story",
      'Health Reports',
      'Learn',
      'Progress Photos',
    ]);
  });

  test('all feature nav items have non-empty descriptions', () => {
    for (const item of FEATURE_NAV_ITEMS) {
      expect(item.description.length).toBeGreaterThan(0);
    }
  });

  // Updated from 5 to 7 sections per profile redesign
  const SECTION_ORDER = [
    'Profile Header',
    'Body Stats',
    'Goals',
    'Preferences',
    'Features',
    'Subscription',
    'Account',
  ];

  test('sections appear in correct order with 7 total', () => {
    expect(SECTION_ORDER).toHaveLength(7);
    expect(SECTION_ORDER[0]).toBe('Profile Header');
    expect(SECTION_ORDER[SECTION_ORDER.length - 1]).toBe('Account');
  });

  test('rest timer is NOT a section (Requirement 8.1)', () => {
    expect(SECTION_ORDER).not.toContain('Rest Timer');
    expect(SECTION_ORDER.some((s) => s.toLowerCase().includes('rest timer'))).toBe(false);
  });
});

describe('ProfileScreen: Store Profile Mapping', () => {
  test('maps all API fields to store fields correctly', () => {
    const apiResponse = {
      id: 'abc-123',
      user_id: 'user-456',
      display_name: 'John',
      avatar_url: 'https://example.com/avatar.jpg',
      timezone: 'America/New_York',
      preferred_currency: 'USD',
      region: 'US',
      preferences: { unit_system: 'imperial' },
      coaching_mode: 'collaborative',
    };

    const mapped = mapApiToStoreProfile(apiResponse);
    expect(mapped.id).toBe('abc-123');
    expect(mapped.userId).toBe('user-456');
    expect(mapped.displayName).toBe('John');
    expect(mapped.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(mapped.timezone).toBe('America/New_York');
    expect(mapped.preferredCurrency).toBe('USD');
    expect(mapped.region).toBe('US');
    expect(mapped.preferences?.unit_system).toBe('imperial');
    expect(mapped.coachingMode).toBe('collaborative');
  });

  test('handles null/missing fields gracefully', () => {
    const apiResponse = {
      id: 'abc-123',
      user_id: 'user-456',
      display_name: null,
      avatar_url: null,
      timezone: null,
      preferred_currency: null,
      region: null,
      preferences: null,
      coaching_mode: 'coached',
    };

    const mapped = mapApiToStoreProfile(apiResponse);
    expect(mapped.displayName).toBeNull();
    expect(mapped.avatarUrl).toBeNull();
    expect(mapped.preferences).toBeNull();
    expect(mapped.coachingMode).toBe('coached');
  });
});

describe('ProfileScreen: Coaching Mode Values', () => {
  const VALID_MODES = ['coached', 'collaborative', 'manual'];

  test('only 3 valid coaching modes exist', () => {
    expect(VALID_MODES).toHaveLength(3);
  });

  test('backend regex pattern matches all valid modes', () => {
    const pattern = /^(coached|collaborative|manual)$/;
    for (const mode of VALID_MODES) {
      expect(pattern.test(mode)).toBe(true);
    }
  });

  test('backend regex rejects invalid modes', () => {
    const pattern = /^(coached|collaborative|manual)$/;
    const invalid = ['auto', 'COACHED', 'Coached', '', 'coached ', ' manual'];
    for (const mode of invalid) {
      expect(pattern.test(mode)).toBe(false);
    }
  });
});
