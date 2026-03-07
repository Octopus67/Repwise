import { Platform } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import api from './api';

// ─── Google ──────────────────────────────────────────────────────────────────

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

let googleConfigured = false;

function ensureGoogleConfigured() {
  if (googleConfigured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    offlineAccess: true,
  });
  googleConfigured = true;
}

export async function signInWithGoogle(): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  ensureGoogleConfigured();
  if (Platform.OS !== 'ios') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  const idToken = response.data?.idToken;
  if (!idToken) throw new Error('No ID token from Google');

  const { data } = await api.post('auth/oauth/google', { provider: "google", token: idToken });
  return data;
}

export function getGoogleSignInError(error: unknown): string {
  if (isErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.SIGN_IN_CANCELLED:
        return '';
      case statusCodes.IN_PROGRESS:
        return 'Sign in already in progress';
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return 'Google Play Services not available';
      default:
        return 'Google sign in failed';
    }
  }
  return (error as Error)?.message ?? 'Google sign in failed';
}

// ─── Apple ───────────────────────────────────────────────────────────────────

export const isAppleAuthAvailable = Platform.OS === 'ios';

export async function signInWithApple(): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const AppleAuth = await import('expo-apple-authentication');
  const Crypto = await import('expo-crypto');

  const nonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nonce,
  );

  const credential = await AppleAuth.signInAsync({
    requestedScopes: [
      AppleAuth.AppleAuthenticationScope.FULL_NAME,
      AppleAuth.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) throw new Error('No identity token from Apple');

  const { data } = await api.post('auth/oauth/apple', {
    identity_token: credential.identityToken,
    nonce,
    full_name: credential.fullName
      ? `${credential.fullName.givenName ?? ''} ${credential.fullName.familyName ?? ''}`.trim()
      : undefined,
  });
  return data;
}

export function getAppleSignInError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'ERR_REQUEST_CANCELED') return '';
  return (error as Error)?.message ?? 'Apple sign in failed';
}
