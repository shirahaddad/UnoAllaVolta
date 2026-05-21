# Todoist "Invalid Token" Bug

## Symptom

After connecting Todoist (Settings shows "Connected", tasks load fine), the app shows a **"Token invalid"** error on the main deck after the app has been in the background for a while or after a device restart.

## Key files

| File | Role |
|------|------|
| `store/authStore.ts` | Stores token in SecureStore; loads on app start and foreground |
| `store/deckStore.ts` | Calls `fetchTasks`; on `TodoistAuthError` sets `error: 'invalid_token'` |
| `services/todoist.ts` | Throws `TodoistAuthError` on any HTTP 401 from Todoist |
| `app/_layout.tsx` | Calls `loadFromStorage` on mount and on AppState foreground transition |

## What has already been changed

**Commit `b28cbd8` — "Add undo toast for mark-done, fix OAuth flow, and auth store hardening"**

- **Removed token auto-clear on 401.** Previously, any 401 from Todoist (in `fetchCards` and `closeTask`) would call `setTodoistToken(null)`, permanently wiping the stored token from SecureStore. A single transient 401 — Todoist blip, network interruption — would log the user out for good.
- **Added SecureStore read-back verification.** After writing the token, the code immediately reads it back and warns if the value is missing.
- **Added AppState listener.** `_layout.tsx` now calls `loadFromStorage` whenever the app returns from background to foreground.
- **Switched OAuth to `openAuthSessionAsync`.** More reliable on Android than `openBrowserAsync` for capturing the redirect URL.

## Remaining hypotheses

### 1. Android SecureStore key invalidation *(most likely)*

`expo-secure-store` on Android uses `EncryptedSharedPreferences` backed by Android Keystore. Certain events can silently invalidate stored keys:

- Changing lock screen PIN, fingerprint, or face unlock
- Some Android OS security updates
- Factory-resetting biometrics

When this happens, `SecureStore.getItemAsync` returns `null` without throwing. The app sends a fetch with `Authorization: Bearer null`, and Todoist responds with 401.

**How to confirm:** look for `[authStore] loadFromStorage todoistToken: null` in the logs at the moment the error appears. If SecureStore is the culprit, this log will appear on every launch after the first failure.

### 2. Real 401 from Todoist *(possible but less likely)*

Todoist OAuth tokens do not expire. They become invalid only if:

- The user revokes access in Todoist → Settings → Integrations → Connected apps
- The user changes their Todoist account password
- The OAuth app is suspended by Todoist

**How to confirm:** check Todoist → Settings → Integrations to see if the app is still listed.

### 3. Race condition on app resume *(possible)*

`useFocusEffect` in `CardDeck` may fire `fetchCards(todoistToken)` before `loadFromStorage` finishes on foreground. If the in-memory `todoistToken` is still `null` at that point, `fetchCards` skips Todoist entirely — this would show an empty deck, not a 401 error. Less likely to be the cause of the `invalid_token` error state, but worth ruling out.

### 4. Token never persisted to SecureStore *(less likely after b28cbd8)*

The read-back verification added in b28cbd8 would log a warning if the write succeeded but the value was unreadable immediately after. No such warning has been observed yet.

## Next steps

### Step 1 — collect logs when it happens

Connect the Android device, run `npx expo start`, and watch the terminal when the error occurs. Look for:

- `[authStore] loadFromStorage todoistToken: null` → SecureStore lost the token → **hypothesis 1**
- `[deckStore] fetchCards error:` with a 401 detail → real API rejection → **hypothesis 2**
- Token logged as present but error still shown → **hypothesis 3** (race condition)

### Step 2 — if hypothesis 1 (SecureStore key loss)

Options in order of invasiveness:

1. **Add `keychainService` to all SecureStore calls** for namespace consistency (low risk, worth trying first).
2. **Detect null-after-connect**: if `loadFromStorage` returns null but the user was previously connected (store a `was_connected` flag in non-encrypted AsyncStorage), show a reconnect prompt instead of silently failing.
3. **Fall back to AsyncStorage**: store a second copy of the token in `AsyncStorage` (less secure, but the token itself is not the user's password — it's an OAuth token that can be revoked). Use it as a recovery path when SecureStore returns null.

### Step 3 — improve the error UX regardless

The current "Token invalid" screen has a **Retry** button, which will keep failing if the token is genuinely gone. It should instead have a **"Reconnect Todoist"** button that navigates to Settings, so the user can re-authenticate without hunting through menus.

```tsx
// components/CardDeck.tsx — replace the invalid_token error block
if (error === 'invalid_token') {
  return (
    <View style={styles.centered}>
      <Ionicons name="warning-outline" size={40} color="#8A8A8A" />
      <Text style={styles.emptyHeading}>Todoist disconnected</Text>
      <Text style={styles.emptyHint}>Your session expired. Reconnect to continue.</Text>
      <TouchableOpacity style={styles.retryButton} onPress={() => router.push('/settings')}>
        <Text style={styles.retryText}>Reconnect Todoist</Text>
      </TouchableOpacity>
    </View>
  );
}
```

## Status

| Date | Action | Outcome |
|------|--------|---------|
| 2026-05-21 | Removed token auto-clear on 401, added SecureStore read-back, added AppState listener (b28cbd8) | Deployed; waiting to see if error recurs |
| — | Collect logs on next occurrence | Pending |
