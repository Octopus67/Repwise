# Google OAuth Setup Guide

## Issue: "Google Play Services not available"

This error appears because Google OAuth is not fully configured. Here's what's needed:

---

## Required Setup Steps

### 1. Create OAuth Credentials in Google Cloud Console

1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client IDs (you need 3):
   - **Web Client ID** (for backend verification)
   - **iOS Client ID** (for iOS app)
   - **Android Client ID** (for Android app)

### 2. Configure Android Client ID

For Android, you need the SHA-1 fingerprint:

```bash
# Development SHA-1
cd app/android
./gradlew signingReport

# Or use keytool
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

Copy the SHA-1 fingerprint and add it to your Android OAuth Client ID in Google Cloud Console.

### 3. Set Environment Variables

Create `app/.env` file:

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=YOUR_IOS_CLIENT_ID.apps.googleusercontent.com
```

**Important:** These must start with `EXPO_PUBLIC_` to be accessible in the app.

### 4. Download google-services.json (Android)

1. In Google Cloud Console, download `google-services.json`
2. Place it at: `app/android/app/google-services.json`

### 5. Download GoogleService-Info.plist (iOS)

1. In Google Cloud Console, download `GoogleService-Info.plist`
2. Place it at: `app/ios/GoogleService-Info.plist`

### 6. Configure app.json Plugin

Update the Google Sign-In plugin in `app/app.json`:

```json
{
  "plugins": [
    [
      "@react-native-google-signin/google-signin",
      {
        "iosUrlScheme": "com.googleusercontent.apps.YOUR_IOS_CLIENT_ID"
      }
    ]
  ]
}
```

Replace `YOUR_IOS_CLIENT_ID` with your actual iOS Client ID (the part before `.apps.googleusercontent.com`).

---

## Quick Fix for Testing (Without Full Setup)

If you want to test the app without Google Sign-In working:

**Option 1: Hide the Google button until configured**

Add this check in `SocialLoginButtons.tsx`:

```tsx
const isGoogleConfigured = !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// Only show Google button if configured
{isGoogleConfigured && (
  <TouchableOpacity onPress={handleGoogle}>
    Continue with Google
  </TouchableOpacity>
)}
```

**Option 2: Show a "Coming Soon" state**

Replace the error with a friendly message:

```tsx
if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
  return 'Google Sign-In coming soon';
}
```

---

## Why This Happens

1. **On iOS:** Google Sign-In doesn't need Play Services, but the code was calling `hasPlayServices()` which always fails on iOS. **This is now fixed** (skips check on iOS).

2. **On Android:** The error appears because:
   - Empty `webClientId` (environment variable not set)
   - Missing `google-services.json` file
   - SHA-1 fingerprint not configured in Google Cloud Console

3. **The library needs proper configuration** to work. Without it, it can't communicate with Google's servers.

---

## Current Status

**What's implemented:**
- ✅ Google Sign-In code (socialAuth.ts)
- ✅ Backend verification (auth/service.py)
- ✅ UI buttons (SocialLoginButtons.tsx)
- ✅ iOS Play Services check fixed

**What's missing (configuration only):**
- ❌ Google OAuth Client IDs (need to create in Google Cloud Console)
- ❌ Environment variables (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, etc.)
- ❌ google-services.json (Android)
- ❌ GoogleService-Info.plist (iOS)
- ❌ SHA-1 fingerprint configured

**This is NOT a code issue - it's a configuration issue.** The code is correct, but Google OAuth requires external setup in Google Cloud Console.

---

## Recommendation

**For immediate testing:**
- Hide the Google button until you configure OAuth credentials
- Or show "Coming Soon" message

**For production:**
- Complete the Google Cloud Console setup (15-30 minutes)
- Add the credentials as environment variables
- Download and add the config files
- Rebuild the app

**The code is ready - it just needs the OAuth credentials from Google.**
