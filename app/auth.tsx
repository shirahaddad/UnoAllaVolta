import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGoogleAuthStore, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '@/store/googleAuthStore';

const REDIRECT_URI = 'https://shirahaddad.github.io/UnoAllaVolta/auth.html';

export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { setTokens } = useGoogleAuthStore();

  useEffect(() => {
    if (!code) {
      router.replace('/settings');
      return;
    }

    (async () => {
      try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code',
          }).toString(),
        });
        const tokenData = await tokenRes.json();

        if (tokenData.access_token) {
          const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          const userData = await userRes.json();

          await setTokens({
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token ?? '',
            expiresIn: tokenData.expires_in ?? 3600,
            email: userData.email ?? '',
          });
        }
      } catch (e) {
        console.error('[auth] token exchange failed:', e);
      }
      router.replace('/settings');
    })();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F0F' }}>
      <ActivityIndicator color="#4A9BAF" size="large" />
    </View>
  );
}
