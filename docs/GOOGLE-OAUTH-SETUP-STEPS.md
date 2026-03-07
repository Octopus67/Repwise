# Google OAuth Setup - Step-by-Step Guide

## Prerequisites
- Google Cloud Console access
- Repwise app Bundle ID: `com.repwise.app` (or your actual Bundle ID)

---

## Step 1: Create Google Cloud Project (5 minutes)

1. Go to https://console.cloud.google.com/
2. Click "Select a project" → "New Project"
3. Name: "Repwise" (or any name)
4. Click "Create"
5. Wait for project creation, then select it

---

## Step 2: Enable Google Sign-In API (2 minutes)

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Sign-In API" or "Google+ API"
3. Click "Enable"

---

## Step 3: Configure OAuth Consent Screen (5 minutes)

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" (unless you have a Google Workspace)
3. Click "Create"
4. Fill in:
   - **App name:** Repwise
   - **User support email:** Your email
   - **App logo:** (optional, can add later)
   - **App domain:** repwise.app (if you have it)
   - **Developer contact:** Your email
5. Click "Save and Continue"
6. **Scopes:** Click "Add or Remove Scopes"
   - Select: `email`, `profile`, `openid`
   - Click "Update" → "Save and Continue"
7. **Test users:** Add your email for testing
8. Click "Save and Continue" → "Back to Dashboard"

---

## Step 4: Create OAuth Client IDs (10 minutes)

### 4a. Web Client ID (for backend)

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Web application**
4. Name: "Repwise Web"
5. Authorized redirect URIs: (leave empty for now, backend doesn't need it)
6. Click "Create"
7. **COPY THE CLIENT ID** - looks like: `123456789-abc123.apps.googleusercontent.com`
8. Save this as `GOOGLE_WEB_CLIENT_ID`

### 4b. iOS Client ID

1. Click "Create Credentials" → "OAuth client ID"
2. Application type: **iOS**
3. Name: "Repwise iOS"
4. Bundle ID: `com.repwise.app` (or your actual Bundle ID from app.json)
5. Click "Create"
6. **COPY THE CLIENT ID** - looks like: `123456789-xyz789.apps.googleusercontent.com`
7. Save this as `GOOGLE_IOS_CLIENT_ID`
8. Also note the **iOS URL scheme** - looks like: `com.googleusercontent.apps.123456789-xyz789`

### 4c. Android Client ID

1. Click "Create Credentials" → "OAuth client ID"
2. Application type: **Android**
3. Name: "Repwise Android"
4. Package name: `com.repwise.app` (from app.json)
5. **SHA-1 certificate fingerprint:** You need to get this first

**Get SHA-1 fingerprint:**

```bash
# For development/debug builds:
cd /Users/manavmht/Documents/HOS/app/android
./gradlew signingReport

# Or use keytool:
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Look for "SHA1:" in the output
# Example: SHA1: A1:B2:C3:D4:E5:F6:G7:H8:I9:J0:K1:L2:M3:N4:O5:P6:Q7:R8:S9:T0
```

6. Paste the SHA-1 into the form
7. Click "Create"
8. **COPY THE CLIENT ID**
9. Save this as `GOOGLE_ANDROID_CLIENT_ID`

---

## Step 5: Download Config Files (2 minutes)

### For Android:

1. In Google Cloud Console, go to "APIs & Services" → "Credentials"
2. Find your Android OAuth Client ID
3. Click "Download JSON" or go to Firebase Console
4. Alternative: Create a Firebase project linked to your Google Cloud project
5. Download `google-services.json`
6. **Save to:** `/Users/manavmht/Documents/HOS/app/android/app/google-services.json`

### For iOS:

1. Similar process for iOS
2. Download `GoogleService-Info.plist`
3. **Save to:** `/Users/manavmht/Documents/HOS/app/ios/GoogleService-Info.plist`

**Note:** If you don't have android/ios folders yet (using Expo managed workflow), you'll need to run `npx expo prebuild` first.

---

## Step 6: Set Environment Variables

Create `/Users/manavmht/Documents/HOS/app/.env`:

```env
# Google OAuth Client IDs (from Step 4)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789-abc123.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=123456789-xyz789.apps.googleusercontent.com
```

**Important:** 
- Replace with your actual Client IDs from Step 4
- Must start with `EXPO_PUBLIC_` to be accessible in React Native
- The Web Client ID is used for both Android and iOS in the code

---

## Step 7: Update app.json Plugin Config

Edit `/Users/manavmht/Documents/HOS/app/app.json`:

Find the `@react-native-google-signin/google-signin` plugin and update it:

```json
{
  "plugins": [
    [
      "@react-native-google-signin/google-signin",
      {
        "iosUrlScheme": "com.googleusercontent.apps.123456789-xyz789"
      }
    ]
  ]
}
```

Replace `123456789-xyz789` with the reversed iOS Client ID from Step 4b.

---

## Step 8: Rebuild the App

```bash
cd /Users/manavmht/Documents/HOS/app

# Clear cache
rm -rf node_modules/.cache

# Rebuild
npx expo prebuild --clean

# Run on iOS
npx expo run:ios

# Or run on Android
npx expo run:android
```

---

## Step 9: Test Google Sign-In

1. Open the app
2. Tap "Continue with Google"
3. You should see:
   - **iOS:** Native Google account picker
   - **Android:** Native account picker (Credential Manager)
4. Select your account
5. Grant permissions
6. You should be logged in!

---

## Troubleshooting

### "DEVELOPER_ERROR" on Android
- **Cause:** SHA-1 fingerprint mismatch
- **Fix:** Verify SHA-1 in Google Cloud Console matches your keystore

### "Sign in failed" with no details
- **Cause:** Wrong Client ID or not configured
- **Fix:** Double-check environment variables match Google Cloud Console

### "Invalid token" from backend
- **Cause:** Backend GOOGLE_CLIENT_ID doesn't match
- **Fix:** Set backend environment variable to match Web Client ID

### Still seeing "Play Services not available"
- **Cause:** Environment variables not loaded
- **Fix:** Restart Metro bundler, rebuild app

---

## Backend Environment Variables

Also set in your backend (Railway, etc.):

```env
GOOGLE_CLIENT_ID=123456789-abc123.apps.googleusercontent.com
```

This should match your **Web Client ID** from Step 4a.

---

## Quick Test Without Full Setup

If you want to test the app without completing Google OAuth setup, I can add a feature flag to hide the Google button. Let me know!

---

**Estimated time to complete:** 15-30 minutes  
**Cost:** FREE (Google OAuth is free)

**Once configured, Google Sign-In will work perfectly with the native account picker!**
