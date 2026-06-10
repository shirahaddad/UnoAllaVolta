import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();

  useEffect(() => {
    const code = Array.isArray(params.code) ? params.code[0] : params.code;
    const state = Array.isArray(params.state) ? params.state[0] : params.state;
    if (code && state) {
      localStorage.setItem('oauth_result', JSON.stringify({ code, state }));
    }
    window.close();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F0F' }}>
      <ActivityIndicator color="#4A9BAF" />
    </View>
  );
}
