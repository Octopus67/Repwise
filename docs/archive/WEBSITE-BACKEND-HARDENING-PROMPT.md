# Repwise Website — Backend & Infrastructure Hardening Prompt

## YOUR MISSION

You are a **Senior Principal Engineer** obsessed with production quality. You've been brought in to harden the Repwise marketing website — NOT the Repwise mobile app backend, but the **Next.js 15 website** at `repwise.app`. Your job: make every API route bulletproof, every page optimized, every security header locked down, every edge case handled, every SEO signal perfect, every deployment pipeline solid. Zero bugs. Zero vulnerabilities. Zero broken links. Zero Lighthouse regressions.

Think like someone who has shipped websites at Vercel, Stripe, and Linear. Think like someone who knows that a marketing website IS the product's first impression — if it's broken, slow, or insecure, users won't trust the app.

**Your standard: Lighthouse 95+ on every metric, zero console errors, zero broken links, zero security warnings, perfect SEO, flawless on every device and browser.**

---

## THE WEBSITE

- **Domain:** repwise.app
- **Stack:** Next.js 15 (App Router), Tailwind CSS v4, Motion (animations), Lenis (smooth scroll), TypeScript strict
- **Hosting:** Vercel (edge CDN, automatic HTTPS)
- **Analytics:** PostHog (cookieless mode)
- **Content:** MDX blog, static pages, no database
- **Design plan:** See `docs/WEBSITE-DESIGN-PLAN.md` for full spec

### Pages
```
/ .................. Homepage (13 sections, SSG)
/features .......... Feature breakdown (SSG)
/pricing ........... Pricing + comparison (SSG)
/about ............. Founder story (SSG)
/blog .............. Blog listing (SSG)
/blog/[slug] ....... Blog post (SSG via generateStaticParams)
/download .......... Smart platform redirect
/privacy ........... Privacy Policy (SSG)
/terms ............. Terms of Service (SSG)
```

### API Routes (if any)
```
/api/contact ....... Contact form submission (POST)
/api/newsletter .... Newsletter signup (POST)  
```

---

## PHASE 1: NEXT.JS CONFIGURATION HARDENING

### next.config.ts — Lock It Down

```typescript
// Every setting must be intentional. No defaults left to chance.

const nextConfig = {
  // SECURITY
  poweredByHeader: false,  // Don't advertise Next.js
  
  // PERFORMANCE  
  reactStrictMode: true,
  
  // IMAGES
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year for immutable assets
  },
  
  // REDIRECTS (SEO — no broken links ever)
  async redirects() {
    return [
      { source: '/privacy-policy', destination: '/privacy', permanent: true },
      { source: '/tos', destination: '/terms', permanent: true },
      { source: '/terms-of-service', destination: '/terms', permanent: true },
      { source: '/features/:path*', destination: '/features', permanent: false },
      // Add any other common URL variations
    ];
  },
  
  // HEADERS (security — see Phase 3)
  async headers() { /* ... */ },
};
```

### Verify These Settings

1. `typescript.tsconfigPath` points to correct tsconfig
2. `eslint.ignoreDuringBuilds` is FALSE (never skip linting)
3. `output` is NOT set to `'export'` (we need SSR for /download redirect)
4. No `experimental` flags that could cause instability
5. `images.remotePatterns` is locked to only domains you control (no open proxy)

---

## PHASE 2: SECURITY HEADERS

Set ALL security headers in `next.config.ts` `headers()` — NOT in middleware (middleware kills static page caching on Vercel).

```typescript
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        // Prevent clickjacking
        { key: 'X-Frame-Options', value: 'DENY' },
        
        // Prevent MIME sniffing
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        
        // XSS protection (legacy browsers)
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        
        // Referrer policy
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        
        // HSTS (force HTTPS, 1 year, include subdomains)
        { 
          key: 'Strict-Transport-Security', 
          value: 'max-age=31536000; includeSubDomains; preload' 
        },
        
        // Permissions policy (disable unused browser features)
        { 
          key: 'Permissions-Policy', 
          value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' 
        },
        
        // Content Security Policy
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us.i.posthog.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self' data:",
            "connect-src 'self' https://us.i.posthog.com https://us.posthog.com",
            "frame-src 'self' https://www.youtube.com",
            "media-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
          ].join('; ')
        },
      ],
    },
  ];
}
```

### Verify

1. Run `securityheaders.com` against the deployed site — target A+ rating
2. CSP doesn't break PostHog, YouTube embeds, or Google Fonts (if used)
3. CSP doesn't break Motion animations or Lenis
4. No `unsafe-eval` unless absolutely required (PostHog may need it — verify and document why)
5. Test in Chrome DevTools → Security tab — zero warnings

---

## PHASE 3: API ROUTE HARDENING

### Contact Form (`app/api/contact/route.ts`)

```typescript
// REQUIREMENTS:
// 1. Zod validation for all fields (name, email, message)
// 2. Rate limiting: 3 requests per IP per hour (use Upstash @upstash/ratelimit + @upstash/redis)
// 3. Honeypot field: hidden input "website" — if filled, silently reject (bot)
// 4. Time check: reject if form submitted < 3 seconds after page load (bot)
// 5. Email via Resend (or log to console in dev)
// 6. Return proper status codes: 200 (success), 400 (validation), 429 (rate limit), 500 (server error)
// 7. NEVER expose internal error details to the client
// 8. Log all submissions (success + failure) with IP, timestamp, and sanitized data
// 9. Sanitize all input: strip HTML tags, trim whitespace, limit lengths
// 10. CORS: same-origin only (default in Next.js, but verify)
```

### Newsletter Signup (`app/api/newsletter/route.ts`)

```typescript
// REQUIREMENTS:
// 1. Zod validation: email only (valid email format)
// 2. Rate limiting: 5 requests per IP per hour
// 3. Honeypot field
// 4. Store in email service (Resend audience, or Mailchimp, or log)
// 5. Duplicate email handling: return 200 (don't reveal if email exists)
// 6. Return: 200 (success), 400 (invalid email), 429 (rate limit)
```

### Smart Download Redirect (`middleware.ts` or `app/download/page.tsx`)

```typescript
// REQUIREMENTS:
// 1. Detect platform from User-Agent:
//    - iOS (iPhone/iPad) → App Store URL
//    - Android → Play Store URL  
//    - Desktop → Show download page with both badges + QR code
// 2. Use Next.js middleware userAgent() utility
// 3. Fallback: if detection fails, show download page (never error)
// 4. Log platform detection for analytics
// 5. Handle edge cases: 
//    - Bots/crawlers → serve the page (don't redirect)
//    - In-app browsers (Instagram, Facebook, Twitter) → may need special handling
//    - Tablets → treat as mobile (redirect to appropriate store)
```

### For ALL API Routes

- Every route handler wrapped in try/catch
- Specific error types caught (ZodError, RateLimitError, etc.) — never broad `catch(e)`
- Proper HTTP status codes (not everything is 500)
- Response body is always JSON with consistent shape: `{ success: boolean, message?: string, errors?: object }`
- No sensitive data in responses (no stack traces, no internal paths)
- Request body size limited (reject payloads > 10KB)
- Content-Type validation (reject non-JSON for POST routes)

---

## PHASE 4: SEO HARDENING

### Sitemap (`app/sitemap.ts`)

```typescript
// Use Next.js built-in sitemap generation (NOT next-sitemap package)
// REQUIREMENTS:
// 1. Include ALL pages: /, /features, /pricing, /about, /blog, /download, /privacy, /terms
// 2. Include ALL blog posts (dynamically from MDX files)
// 3. Set appropriate changeFrequency: homepage=weekly, blog=weekly, others=monthly
// 4. Set priority: homepage=1.0, features/pricing=0.8, blog=0.7, others=0.5
// 5. Set lastModified from file system timestamps or git commit dates
// 6. Verify sitemap is accessible at /sitemap.xml
// 7. Submit to Google Search Console
```

### Robots.txt (`app/robots.ts`)

```typescript
// REQUIREMENTS:
// 1. Allow all crawlers on all pages
// 2. Disallow /api/* (no indexing of API routes)
// 3. Point to sitemap: https://repwise.app/sitemap.xml
// 4. Verify at /robots.txt
```

### Structured Data (JSON-LD)

Every page needs appropriate structured data:

| Page | Schema Type | Required Fields |
|------|------------|-----------------|
| Homepage | `SoftwareApplication` + `Organization` + `FAQPage` | name, description, operatingSystem, applicationCategory, offers, aggregateRating |
| Blog post | `BlogPosting` + `BreadcrumbList` | headline, datePublished, dateModified, author, image, description |
| Pricing | `SoftwareApplication` with `offers` | price, priceCurrency, availability |
| All pages | `BreadcrumbList` | Proper breadcrumb chain |

```typescript
// Use schema-dts package for type safety
// Render as <script type="application/ld+json"> in page head
// Validate with Google Rich Results Test: https://search.google.com/test/rich-results
```

### Meta Tags — Every Page

```typescript
// VERIFY for every page:
// 1. <title> — unique, 50-60 chars, includes "Repwise"
// 2. <meta name="description"> — unique, 150-160 chars, includes primary keyword
// 3. <meta property="og:title"> — same as title or slightly different
// 4. <meta property="og:description"> — same as description
// 5. <meta property="og:image"> — 1200x630, unique per page if possible
// 6. <meta property="og:url"> — canonical URL
// 7. <meta property="og:type"> — "website" or "article" for blog
// 8. <meta name="twitter:card"> — "summary_large_image"
// 9. <link rel="canonical"> — self-referencing canonical URL
// 10. <html lang="en">
```

### OG Image Generation

```typescript
// Use app/opengraph-image.tsx (or per-page variants)
// Use @vercel/og ImageResponse for dynamic OG images
// REQUIREMENTS:
// 1. Default OG image: dark bg + logo + tagline + app screenshot
// 2. Blog posts: dynamic OG with post title + category + date
// 3. Size: 1200x630
// 4. Test with: https://www.opengraph.xyz/
```

### Canonical URLs

- Every page has a self-referencing canonical
- No trailing slashes (or always trailing slashes — pick one and enforce)
- No duplicate content (www vs non-www, http vs https)
- Verify with: `curl -I https://repwise.app` — check for redirects

---

## PHASE 5: PERFORMANCE HARDENING

### Lighthouse Audit — Target 95+ on ALL Metrics

Run Lighthouse on EVERY page and fix ALL issues:

| Page | Performance | Accessibility | Best Practices | SEO |
|------|------------|---------------|----------------|-----|
| / | ≥ 95 | ≥ 95 | ≥ 95 | ≥ 95 |
| /features | ≥ 95 | ≥ 95 | ≥ 95 | ≥ 95 |
| /pricing | ≥ 95 | ≥ 95 | ≥ 95 | ≥ 95 |
| /about | ≥ 95 | ≥ 95 | ≥ 95 | ≥ 95 |
| /blog | ≥ 95 | ≥ 95 | ≥ 95 | ≥ 95 |
| /blog/[slug] | ≥ 95 | ≥ 95 | ≥ 95 | ≥ 95 |
| /download | ≥ 95 | ≥ 95 | ≥ 95 | ≥ 95 |
| /privacy | ≥ 95 | ≥ 95 | ≥ 95 | ≥ 95 |
| /terms | ≥ 95 | ≥ 95 | ≥ 95 | ≥ 95 |

### Core Web Vitals

| Metric | Target | How to Achieve |
|--------|--------|---------------|
| LCP | < 2.5s | Hero image with `priority` + `placeholder="blur"`, preload fonts via `next/font` |
| FID/INP | < 200ms | No heavy JS on main thread, defer PostHog, lazy load below-fold components |
| CLS | < 0.1 | Explicit width/height on all images, font-display: swap via next/font, no layout shifts from animations |

### Image Optimization

1. ALL images use `next/image` component (never raw `<img>`)
2. Hero image: `priority={true}`, `placeholder="blur"`, `sizes` attribute set correctly
3. Below-fold images: `loading="lazy"` (default)
4. Formats: AVIF with WebP fallback (configured in next.config.ts)
5. No images larger than necessary — check actual rendered size vs source size
6. SVGs: inline for small icons, `next/image` for complex SVGs
7. OG image: pre-generated, not on-demand (avoid cold start latency)

### Font Optimization

```typescript
// In app/layout.tsx:
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'optional', // Non-critical font — don't block render
  variable: '--font-mono',
});
```

- `display: 'swap'` for Inter (critical — body text)
- `display: 'optional'` for JetBrains Mono (non-critical — data numbers)
- Verify no FOUT (Flash of Unstyled Text) or FOIT (Flash of Invisible Text)

### Bundle Size

1. Run `next build` and check the output — no page should exceed 100KB JS
2. Use `@next/bundle-analyzer` to identify large dependencies
3. `motion` library: use `LazyMotion` + `domAnimation` (NOT full bundle)
4. Lenis: verify it's tree-shaken properly
5. PostHog: loaded async, NOT in the critical path
6. `lucide-react`: import individual icons, not the entire package
7. No unused dependencies in package.json

### Caching Strategy

| Resource | Cache Header | Notes |
|----------|-------------|-------|
| Static pages (/, /features, etc.) | `s-maxage=86400, stale-while-revalidate` | Vercel CDN caches, revalidate daily |
| Blog posts | `s-maxage=86400, stale-while-revalidate` | Rebuild on deploy |
| Static assets (JS, CSS, images) | `immutable, max-age=31536000` | Content-hashed filenames |
| API routes | `no-store` | Never cache form submissions |
| Sitemap | `s-maxage=86400` | Regenerate daily |

Verify with: `curl -I https://repwise.app` — check `Cache-Control` headers.

---

## PHASE 6: ACCESSIBILITY HARDENING (WCAG AA)

### Automated Checks

1. Run `axe-core` on every page (via browser extension or CI)
2. Zero violations at AA level
3. Zero "serious" or "critical" issues

### Manual Checks

| Check | How | Target |
|-------|-----|--------|
| Keyboard navigation | Tab through entire page | Every interactive element reachable, logical order |
| Focus indicators | Tab through page | 2px solid cyan outline visible on every focusable element |
| Screen reader | VoiceOver (macOS) or NVDA | All content announced correctly, no "unlabeled button" |
| Color contrast | Chrome DevTools | All text ≥ 4.5:1 ratio (already verified in design plan) |
| Skip link | Tab on page load | "Skip to main content" link appears, works |
| Heading hierarchy | Check with HeadingsMap extension | Strict h1→h2→h3, single h1 per page |
| Alt text | Check every `<img>` | Descriptive alt text, decorative images have `alt=""` |
| Touch targets | Test on mobile | All buttons/links ≥ 48x48px |
| Reduced motion | Enable `prefers-reduced-motion` in OS | All animations disabled or reduced to simple fades |
| Zoom | Browser zoom to 200% | No content overflow, no horizontal scroll |
| Language | Check `<html>` tag | `lang="en"` present |

### Specific Animation Accessibility

```typescript
// In EVERY animation component:
const prefersReducedMotion = useReducedMotion();

if (prefersReducedMotion) {
  // Return static version — no transforms, no springs
  // Simple opacity fade (150ms) is acceptable
  // No parallax, no floating, no particles
}
```

Verify: enable "Reduce motion" in macOS System Settings → Accessibility → Display. The entire site should still be fully functional and beautiful, just without movement.

---

## PHASE 7: ERROR HANDLING & EDGE CASES

### Custom Error Pages

```
app/
├── not-found.tsx      # 404 — "This page skipped leg day."
├── error.tsx          # Client-side errors (must be 'use client')
├── global-error.tsx   # Root layout errors (must be 'use client')
└── loading.tsx        # Global loading state (optional)
```

### 404 Page Requirements
- Matches site design (dark theme, cyan accent)
- "404" in hero size, JetBrains Mono, cyan
- "This page skipped leg day." in body-lg
- CTA: "Go Home" button → /
- Centered, min-height 60vh
- Proper meta tags (noindex)

### Error Boundary Requirements
- `error.tsx`: catches client-side errors, shows friendly message, "Try Again" button that calls `reset()`
- `global-error.tsx`: catches root layout errors (rare but critical)
- Both: log error to PostHog/Sentry, show user-friendly message, never expose stack traces

### Edge Cases to Handle

| Scenario | Expected Behavior |
|----------|-------------------|
| JavaScript disabled | Page content still visible (SSR/SSG), animations don't break layout |
| Slow connection (3G) | Content loads progressively, no blank screens, skeleton states |
| Browser back/forward | Page transitions work correctly, scroll position restored |
| Deep link to section (/#pricing) | Smooth scroll to section after page load |
| Blog post doesn't exist | 404 page (not a crash) |
| Empty blog (no posts yet) | Graceful empty state, not a blank page |
| Very long blog post title | Truncated properly in cards, full in detail page |
| Special characters in blog content | Properly escaped, no XSS |
| Multiple rapid form submissions | Rate limited, button disabled after first submit |
| Form submission with JS disabled | Graceful degradation (show message or redirect) |
| Print stylesheet | Clean print layout for blog posts and legal pages |
| Right-to-left text | Not required, but don't break if someone pastes RTL text |
| Very wide/narrow viewports | No horizontal scroll at any width from 320px to 4K |
| iOS Safari quirks | 100vh fix (use `dvh`), safe area insets, rubber band scroll |
| Dark reader extension | Don't fight it, but verify it doesn't break layout |

---

## PHASE 8: CROSS-BROWSER & DEVICE TESTING

### Browser Matrix

| Browser | Version | Priority |
|---------|---------|----------|
| Chrome | Latest 2 | P0 |
| Safari | Latest 2 (macOS + iOS) | P0 |
| Firefox | Latest 2 | P1 |
| Edge | Latest 2 | P1 |
| Samsung Internet | Latest | P2 |
| Safari (iOS 15+) | Latest 3 | P0 (most mobile users) |

### Device Testing

| Device | What to Check |
|--------|--------------|
| iPhone SE (375px) | Smallest supported width, all content visible, touch targets 48px |
| iPhone 14/15 (390px) | Primary mobile experience, safe area insets |
| iPhone 14/15 Pro Max (430px) | Large phone, verify layout scales |
| iPad (768px) | Tablet layout, 2-column grids |
| iPad Pro (1024px) | Tablet/desktop breakpoint |
| 1280px laptop | Primary desktop experience |
| 1920px monitor | Full desktop, verify max-width constraints |
| 2560px+ ultrawide | No content stretching, centered layout |

### What to Verify on Each

1. No horizontal scroll at any viewport width
2. All text readable (no truncation, no overflow)
3. All images load and are properly sized
4. All animations play smoothly (no jank)
5. All interactive elements work (buttons, accordions, carousels, forms)
6. Navigation works (hamburger on mobile, full nav on desktop)
7. Sticky elements don't overlap content
8. Footer is always at bottom (even on short pages)
9. Custom cursor hidden on touch devices
10. App Store badges link to correct stores

---

## PHASE 9: ANALYTICS & MONITORING

### PostHog Setup

```typescript
// REQUIREMENTS:
// 1. Initialize in instrumentation-client.ts (Next.js 15 convention)
// 2. Cookieless mode: persistence: 'memory' (no cookie banner needed)
// 3. Reverse proxy via Next.js rewrites (avoid ad blockers):
//    /ingest/* → https://us.i.posthog.com/*
// 4. Track these events:
//    - page_view (automatic with PostHog React)
//    - cta_click (location: hero/pricing/final/sticky/header)
//    - pricing_toggle (monthly/yearly)
//    - store_link_click (platform: ios/android)
//    - community_link_click
//    - faq_expand (question text)
//    - feature_accordion_expand (category name)
//    - screenshot_carousel_interact
//    - contact_form_submit (success/failure)
//    - newsletter_signup (success/failure)
//    - download_redirect (platform detected)
// 5. Do NOT track PII (no email, no name in events)
// 6. Load async — NOT in critical rendering path
```

### Error Monitoring

- Add Sentry for client-side error tracking (or use PostHog's error tracking)
- Capture: unhandled exceptions, unhandled promise rejections, console.error
- Context: page URL, browser, viewport size, user actions leading to error
- Alert on: any error with > 5 occurrences in 1 hour

### Uptime Monitoring

- Set up Vercel's built-in analytics (Web Vitals)
- Consider: BetterUptime or similar for uptime monitoring
- Monitor: /, /features, /pricing, /blog (at minimum)
- Alert on: downtime > 1 minute, Lighthouse score drop > 10 points

---

## PHASE 10: BUILD & DEPLOYMENT HARDENING

### Build Verification

```bash
# EVERY build must pass ALL of these:
next build                    # Zero errors, zero warnings
next lint                     # Zero ESLint errors
tsc --noEmit                  # Zero TypeScript errors
```

### Pre-Deployment Checklist

| Check | Command/Tool | Pass Criteria |
|-------|-------------|---------------|
| TypeScript | `tsc --noEmit` | Zero errors |
| ESLint | `next lint` | Zero errors, zero warnings |
| Build | `next build` | Successful, no warnings |
| Bundle size | Build output | No page > 100KB JS |
| Lighthouse (local) | Chrome DevTools | 95+ all metrics, all pages |
| Links | `linkinator` or similar | Zero broken links |
| Accessibility | `axe-core` | Zero AA violations |
| Security headers | `securityheaders.com` | A+ rating |
| Structured data | Google Rich Results Test | Valid, no errors |
| OG images | `opengraph.xyz` | Correct for all pages |
| Mobile | Chrome DevTools device mode | No issues at 375px |
| Forms | Manual test | Submit, rate limit, validation all work |
| 404 page | Visit /nonexistent | Custom 404 renders correctly |
| Sitemap | Visit /sitemap.xml | All pages listed, valid XML |
| Robots | Visit /robots.txt | Correct directives |
| Canonical URLs | Check each page source | Self-referencing, correct |
| Console | Chrome DevTools | Zero errors, zero warnings |
| Network | Chrome DevTools | No failed requests, no mixed content |

### Environment Variables

```bash
# .env.local (development)
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_APP_STORE_URL=#
NEXT_PUBLIC_PLAY_STORE_URL=#
RESEND_API_KEY=re_...           # Server-only (no NEXT_PUBLIC_ prefix!)
UPSTASH_REDIS_REST_URL=...      # Server-only
UPSTASH_REDIS_REST_TOKEN=...    # Server-only

# Validate with @t3-oss/env-nextjs:
// env.ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    RESEND_API_KEY: z.string().startsWith("re_"),
    UPSTASH_REDIS_REST_URL: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_POSTHOG_KEY: z.string().startsWith("phc_"),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url(),
    NEXT_PUBLIC_APP_STORE_URL: z.string().url(),
    NEXT_PUBLIC_PLAY_STORE_URL: z.string().url(),
  },
  runtimeEnv: { /* ... */ },
});
```

- NEVER commit `.env.local` to git
- Use Vercel environment settings for production/preview
- Validate all env vars at build time with `@t3-oss/env-nextjs`
- Server-only secrets NEVER have `NEXT_PUBLIC_` prefix

---

## VERIFICATION PROTOCOL (NON-NEGOTIABLE)

After EVERY phase:

1. `next build` — zero errors
2. `next lint` — zero errors
3. `tsc --noEmit` — zero errors
4. Lighthouse audit on affected pages — 95+ all metrics
5. Manual test on mobile (375px) and desktop (1280px)
6. Check browser console — zero errors, zero warnings

After ALL phases:

1. Full Lighthouse audit on every page
2. Full accessibility audit (axe-core) on every page
3. Full link check (zero broken links)
4. Security headers check (A+ on securityheaders.com)
5. Structured data validation (Google Rich Results Test)
6. OG image validation (opengraph.xyz)
7. Cross-browser spot check (Chrome, Safari, Firefox)
8. Mobile spot check (iPhone SE width, iPhone 15 width)

---

## EXECUTION ORDER

1. **Phase 1**: next.config.ts hardening (foundation)
2. **Phase 2**: Security headers (protect users)
3. **Phase 3**: API route hardening (forms, redirects)
4. **Phase 4**: SEO hardening (sitemap, structured data, meta tags, OG images)
5. **Phase 5**: Performance hardening (Lighthouse 95+, Core Web Vitals, bundle size)
6. **Phase 6**: Accessibility hardening (WCAG AA, keyboard nav, screen readers)
7. **Phase 7**: Error handling & edge cases (404, error boundaries, edge cases)
8. **Phase 8**: Cross-browser & device testing (browser matrix, device matrix)
9. **Phase 9**: Analytics & monitoring (PostHog, error tracking, uptime)
10. **Phase 10**: Build & deployment hardening (CI checks, env vars, pre-deploy checklist)

---

## DO NOT

- Do NOT change the visual design, animations, or content — this is a hardening pass
- Do NOT add new pages or features
- Do NOT remove any existing functionality
- Do NOT skip any phase
- Do NOT declare done without running the full verification protocol
- Do NOT leave any console errors or warnings
- Do NOT leave any Lighthouse score below 95
- Do NOT leave any accessibility violation
- Do NOT expose server-side secrets to the client
- Do NOT cache API route responses

## DO

- Fix every issue you find, no matter how small
- Document every change with a comment explaining WHY
- Test on real devices, not just Chrome DevTools emulation
- Think about what happens when things go wrong (network errors, missing data, slow connections)
- Think about what a security auditor would flag
- Think about what Google's crawler needs to see
- Make this website so solid that it runs flawlessly for years without maintenance
