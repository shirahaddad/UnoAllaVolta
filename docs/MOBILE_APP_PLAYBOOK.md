# Mobile App Playbook (React Native + Expo)

A personal reference built from building UnoAllaVolta. Stack: React Native, Expo managed workflow, Expo Router, Zustand, EAS Build.

---

## 1. Project Setup

```bash
npx create-expo-app MyApp --template
cd MyApp
eas init  # links to Expo account, writes projectId into app.json
```

**`app.json` fields to set immediately:**
- `name`, `slug`, `version`
- `scheme` — your deep link scheme (e.g. `"myapp"`)
- `ios.bundleIdentifier` — e.g. `com.yourname.myapp`
- `android.package` — same format

**`.env.local`** for local secrets. Client-side vars **must** be prefixed `EXPO_PUBLIC_`:
```
EXPO_PUBLIC_API_KEY=abc123
SOME_BUILD_ONLY_VAR=secret   # not accessible at runtime
```

**`eas.json`** — commit three profiles:
```json
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal" },
    "production": { "autoIncrement": true }
  }
}
```

---

## 2. File Structure (Expo Router)

```
app/
  _layout.tsx          ← root layout; load persisted state here before splash hides
  (tabs)/              ← tab navigator (each file = one tab)
    index.tsx
  settings.tsx         ← other screens
  auth.tsx             ← OAuth callback handler
components/            ← shared UI components
store/                 ← Zustand stores (one per domain)
services/              ← all fetch/API calls
utils/                 ← pure helpers
assets/images/         ← icon, splash, adaptive icon assets
docs/                  ← static files served via GitHub Pages (e.g. auth.html)
```

---

## 3. State Management (Zustand + SecureStore)

One store per domain. Each store has:
- In-memory state (Zustand)
- `loadFromStorage()` that hydrates from SecureStore on boot
- Persisted writes inside actions

```ts
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const KEY = 'my_token';

interface AuthState {
  token: string | null;
  setToken: (t: string | null) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  setToken: async (token) => {
    if (token) await SecureStore.setItemAsync(KEY, token);
    else await SecureStore.deleteItemAsync(KEY);
    set({ token });
  },
  loadFromStorage: async () => {
    const token = await SecureStore.getItemAsync(KEY);
    if (token) set({ token });
  },
}));
```

**In `app/_layout.tsx`** — hydrate all stores before hiding the splash screen:
```ts
await Promise.all([
  useAuthStore.getState().loadFromStorage(),
  useSettingsStore.getState().loadFromStorage(),
]);
await SplashScreen.hideAsync();
```

**SecureStore limits:**
- **2048 bytes per key** — do not store arrays or lists there
- For non-sensitive larger data, use AsyncStorage — but it's a native module that requires a rebuild, so plan for it upfront

---

## 4. Navigation

```ts
const router = useRouter();
router.push('/settings');
router.back();
router.replace('/home');  // replaces current screen (no back)
```

Pass params via URL, read with `useLocalSearchParams()`:
```ts
router.push('/auth?code=abc&state=google');
// in auth.tsx:
const { code, state } = useLocalSearchParams<{ code: string; state: string }>();
```

Refresh data when a screen comes into focus:
```ts
useFocusEffect(
  useCallback(() => {
    fetchData();
  }, [dependency])
);
```
Note: `useFocusEffect` fires on every focus, not just mount. Always wrap in `useCallback`.

---

## 5. OAuth Flows

**The pattern** (works for any OAuth provider without a native SDK):

```
Settings screen
  → WebBrowser.openBrowserAsync(authUrl)
  → Provider consent screen
  → Redirect to https://yourusername.github.io/RepoName/auth.html?code=...&state=...
  → auth.html fires deep link: yourscheme://auth?code=...&state=...
  → OS opens app, routes to app/auth.tsx
  → auth.tsx exchanges code for token, saves to store, navigates to /settings
```

**`docs/auth.html`** (hosted on GitHub Pages):
```html
<script>
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (code) {
    window.location.href = 'yourscheme://auth?' + params.toString();
  } else {
    document.body.textContent = params.get('error') || 'Something went wrong.';
  }
</script>
<body>Redirecting...</body>
```

**`app/auth.tsx`** — stateless; reads everything from URL params (JS reloads after deep link fires):
```ts
const { code, state } = useLocalSearchParams();
// use `state` to distinguish which provider the callback is for
// exchange code → token → save to store → router.replace('/settings')
```

**Token refresh** (Google pattern):
```ts
getValidToken: async () => {
  const { accessToken, refreshToken, expiresAt } = get();
  if (accessToken && Date.now() < expiresAt - 60_000) return accessToken;
  if (!refreshToken) return null;
  // fetch new token, save, return
},
```

**Google consent screen note:** Until your app is verified, Google shows the redirect URI domain (e.g. `yourusername.github.io`) instead of your app name. Set the App name in Google Cloud Console → OAuth consent screen to make it less alarming during development/testing.

---

## 6. External APIs

Keep all `fetch` calls in `services/` — never import them directly in components:

```ts
// services/myapi.ts
export class MyAuthError extends Error {}

export async function fetchData(token: string) {
  const res = await fetch('https://api.example.com/data', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new MyAuthError('invalid token');
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

Auto-clear bad tokens in stores when a typed auth error is caught:
```ts
fetchData(token).catch((e) => {
  if (e instanceof MyAuthError) useAuthStore.getState().setToken(null);
});
```

---

## 7. Performance: Parallel Fetches

Run independent async branches concurrently:
```ts
// Bad — sequential
const tasks = await fetchTasks(token);
const googleToken = await getValidToken();

// Good — parallel
const [tasks, googleToken] = await Promise.all([
  fetchTasks(token),
  getValidToken(),
]);
```

Use static top-level imports — avoid `await import(...)` inside hot paths.

Cache list data in Zustand memory and use stale-while-revalidate:
```ts
if (cachedList.length > 0) {
  // use immediately, refresh in background
  useData(cachedList);
  fetchFreshList().then(setCachedList).catch(() => {});
} else {
  const fresh = await fetchFreshList();
  setCachedList(fresh);
  useData(fresh);
}
```

---

## 8. UI Patterns

**Screen wrapper:**
```tsx
<SafeAreaView style={{ flex: 1 }}>
  <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  >
    <ScrollView keyboardShouldPersistTaps="handled">
      {/* content */}
    </ScrollView>
  </KeyboardAvoidingView>
</SafeAreaView>
```

**Swipe gesture:**
```ts
const translateX = useRef(new Animated.Value(0)).current;
const panResponder = PanResponder.create({
  onMoveShouldSetPanResponder: (_, { dx }) => Math.abs(dx) > 5,
  onPanResponderMove: (_, { dx }) => translateX.setValue(dx),
  onPanResponderRelease: (_, { dx }) => {
    if (dx > THRESHOLD) Animated.timing(translateX, { toValue: 500, ... }).start(onDone);
    else Animated.spring(translateX, { toValue: 0, ... }).start();
  },
});
```

**Pull-to-refresh** — use a separate `isRefreshing` state, not the global `isLoading`:
```tsx
const [isRefreshing, setIsRefreshing] = useState(false);
const handleRefresh = async () => {
  setIsRefreshing(true);
  await fetchData();
  setIsRefreshing(false);
};
// Show ActivityIndicator only on isLoading && !isRefreshing
// Pass isRefreshing (not isLoading) to RefreshControl
```

**Force remount** a component: change its `key` prop.

---

## 9. Building

| Goal | Command |
|---|---|
| Local dev (hot reload) | `npx expo start` |
| Standalone Android APK | `eas build --platform android --profile preview` |
| Standalone iOS (needs Apple account) | `eas build --platform ios --profile preview` |
| Store release build | `eas build --platform all --profile production` |

### Critical: environment variables in EAS builds

`.env.local` is **never sent to EAS servers**. Before your first cloud build, add every `EXPO_PUBLIC_*` variable to EAS:

```bash
eas env:create --name EXPO_PUBLIC_API_KEY --environment preview --visibility plaintext
eas env:create --name EXPO_PUBLIC_API_KEY --environment production --visibility plaintext
```

Do this for every profile you build for (preview, production). Values are entered interactively.

### Installing a new build on Android

If the signing key or build type changed (e.g. dev client → preview), Android will reject the update with a signature mismatch. **Uninstall the old app first**, then install the new APK.

---

## 10. Publishing Checklist

1. **Privacy policy** — host a simple static page (GitHub Pages works fine). Required by Google, Apple, and Play Store. Must state what data you collect (e.g. calendar events, task data, email address) and that it stays on-device / isn't shared.

2. **Google OAuth verification** — in Google Cloud Console, set App name, then click "Publish App" on the OAuth consent screen to leave Testing mode. Note: `calendar.readonly` is a **sensitive scope** and requires a CASA Tier 2 security assessment (~$75–150, takes a few weeks). Budget time for this.

3. **Todoist (or other OAuth providers)** — register a production app through the provider's developer portal so the consent screen shows your app name instead of your dev app name.

4. **Apple Developer account** — $99/year; required for any iOS distribution including TestFlight internal testing.

5. **Google Play developer account** — $25 one-time fee.

6. **EAS production build** — `eas build --profile production`. The `autoIncrement: true` setting handles version bumping.

7. **App store assets** — screenshots for multiple device sizes (Apple requires several), short description, long description, category, age rating, content rating questionnaire.

8. **Data safety declarations** — both stores ask what data the app collects during submission. Be accurate: declare calendar and task data; state that it's not shared with third parties or uploaded to a server.

---

## 11. Gotchas

| Gotcha | Fix |
|---|---|
| `process.env.MY_VAR` is `undefined` at runtime | Add `EXPO_PUBLIC_` prefix |
| SecureStore silently fails for values > 2048 bytes | Don't store arrays/lists there; use in-memory Zustand state |
| AsyncStorage (or any new native module) won't work without a rebuild | Plan native dependencies before first EAS build |
| OAuth deep link causes JS reload, wiping component state | `app/auth.tsx` must be stateless — read everything from URL params |
| Google consent screen shows `yourusername.github.io` | Set App name in Google Cloud Console; full verification removes it |
| Android rejects APK install with "signature mismatch" | Uninstall old build first |
| `useFocusEffect` fires on every focus, not just mount | Always wrap callback in `useCallback` |
| `Promise.all` with `[[], []] as const` fails TypeScript | Use `Promise.resolve([[], []] as const)` for the fallback branch |
