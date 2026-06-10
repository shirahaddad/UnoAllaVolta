import { Platform } from 'react-native';

export const GITHUB_REDIRECT_URI = 'https://shirahaddad.github.io/UnoAllaVolta/auth.html';

export function getOAuthRedirectUri(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const base = process.env.EXPO_BASE_URL ?? '';
    return window.location.origin + base + '/auth-callback';
  }
  return GITHUB_REDIRECT_URI;
}
