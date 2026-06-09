import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGoogleAuthStore, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '@/store/googleAuthStore';
import { useAuthStore, TODOIST_CLIENT_ID, TODOIST_CLIENT_SECRET } from '@/store/authStore';

const REDIRECT_URI = 'https://shirahaddad.github.io/UnoAllaVolta/auth.html';

export default function AuthCallback() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { setTokens } = useGoogleAuthStore();
  const { setTodoistToken, setTodoistRefreshToken } = useAuthStore();
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    const code = Array.isArray(params.code) ? params.code[0] : params.code;
    const state = Array.isArray(params.state) ? params.state[0] : params.state;

    if (!code) {
      setTimeout(() => router.back(), 800);
      return;
    }

    (async () => {
      try {
        if (state === 'todoist') {
          setStatus('Connecting Todoist...');
          const res = await fetch('https://todoist.com/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: TODOIST_CLIENT_ID,
              client_secret: TODOIST_CLIENT_SECRET,
            }).toString(),
          });
          const data = await res.json();
          console.log('[auth] todoist token exchange response:', JSON.stringify(data));
          if (data.access_token) {
            await setTodoistToken(data.access_token);
            if (data.refresh_token) {
              await setTodoistRefreshToken(data.refresh_token);
            }
            setStatus('Todoist connected!');
          }
        } else {
          setStatus('Connecting Google Calendar...');
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
            setStatus('Google Calendar connected!');
          }
        }
      } catch (e) {
        console.error('[auth] error:', e);
      }
      setTimeout(() => router.back(), 800);
    })();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F0F', gap: 16 }}>
      <ActivityIndicator color="#4A9BAF" size="large" />
      <Text style={{ color: '#8A8A8A', fontSize: 14 }}>{status}</Text>
    </View>
  );
}
