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

### 2. Real 401 from Todoist *(confirmed for 2026-05-23 occurrence)*

Todoist OAuth tokens do not expire. They become invalid only if:

- The user revokes access in Todoist → Settings → Integrations → Connected apps
- The user changes their Todoist account password
- The OAuth app is suspended by Todoist
- Todoist has a transient auth server issue

**2026-05-23 finding:** The app was still listed in Todoist → Preferences → Integrations — so the token was not revoked by the user. The 401 was either a transient Todoist server blip, or the token was silently invalidated on Todoist's side (e.g. after a previous reconnect issued a new token). Checking the integrations page is **not a useful diagnostic** — if the app is listed there, it only rules out user-initiated revocation, not other causes.

**Next diagnostic:** see "Capture Todoist 401 response body" below.

### 3. Race condition on app resume *(possible)*

`useFocusEffect` in `CardDeck` may fire `fetchCards(todoistToken)` before `loadFromStorage` finishes on foreground. If the in-memory `todoistToken` is still `null` at that point, `fetchCards` skips Todoist entirely — this would show an empty deck, not a 401 error. Less likely to be the cause of the `invalid_token` error state, but worth ruling out.

### 4. Token never persisted to SecureStore *(less likely after b28cbd8)*

The read-back verification added in b28cbd8 would log a warning if the write succeeded but the value was unreadable immediately after. No such warning has been observed yet.

## Next steps

### Step 0 — UX fix: Reconnect Todoist button now clears the stale token

**Problem (observed 2026-05-23):** "Reconnect Todoist" navigated to Settings while `todoistToken` was still non-null in the store. Settings showed "Connected" with a Disconnect button. The user had to manually disconnect and reconnect.

**Fix (implemented):** `CardDeck.tsx` — when the error is "session error" (token was present but rejected), "Reconnect Todoist" now calls `setTodoistToken(null)` before navigating. Settings will see `todoistToken === null` and show the "Connect Todoist" button immediately.

### Step 1 — read the in-app error message (no logs needed)

The error screen now shows two different messages depending on what `authStore.tokenFoundInStorage` is at the time of the error:

| Message shown | Meaning | Hypothesis |
|---------------|---------|------------|
| **"Todoist disconnected — Your session was lost"** | SecureStore returned null on last load; token is gone from storage | **Hypothesis 1** (SecureStore key invalidation) |
| **"Todoist session error — This may be temporary"** | Token was present in storage but Todoist returned 401 | **Hypothesis 2** (real API rejection or transient) |

The "Reconnect Todoist" button on both screens navigates directly to Settings. The "Retry" button only appears on the session-error variant.

This works in preview builds with no dev server needed.

### Step 1b — logs via adb (secondary option, needs USB cable)

Even with a preview build, `console.log` output is readable via Android Debug Bridge if USB debugging is enabled on the device:

```
adb logcat | grep ReactNativeJS
```

Look for:
- `[authStore] loadFromStorage todoistToken: null` → hypothesis 1
- `[deckStore] fetchCards error:` → hypothesis 2

### Step 2 — read the 401 detail on the error screen (implemented)

We now surface Todoist's actual rejection reason directly on the error screen, below the subtitle. No adb cable or developer tools needed.

**What was changed:**
- `services/todoist.ts` — 401 response body is read and passed as the `TodoistAuthError` message
- `store/deckStore.ts` — `authErrorDetail` field stores the message from the caught error
- `components/CardDeck.tsx` — displays `authErrorDetail` in small monospace text on the error screen

**Next occurrence:** the error screen will show Todoist's raw response (e.g. `{"error_tag":"AUTHZ_PERMISSION_DENIED",...}`) below "Todoist rejected your session." That tells us exactly why Todoist rejected the token.

### Step 3 — if hypothesis 1 (SecureStore key loss)

Options in order of invasiveness:

1. **Add `keychainService` to all SecureStore calls** for namespace consistency (low risk, worth trying first).
2. **Detect null-after-connect**: if `loadFromStorage` returns null but the user was previously connected (store a `was_connected` flag in non-encrypted AsyncStorage), show a reconnect prompt instead of silently failing.
3. **Fall back to AsyncStorage**: store a second copy of the token in `AsyncStorage` (less secure, but the token itself is not the user's password — it's an OAuth token that can be revoked). Use it as a recovery path when SecureStore returns null.

## Status

| Date | Action | Outcome |
|------|--------|---------|
| 2026-05-21 | Removed token auto-clear on 401, added SecureStore read-back, added AppState listener (b28cbd8) | Deployed; needs new preview build |
| 2026-05-21 | Added `tokenFoundInStorage` to authStore; error screen now shows "session lost" vs "session error" to distinguish hypotheses without needing logs | Needs new preview build to test |
| 2026-05-23 | Error occurred again — showed **"Todoist session error"** (not "disconnected"), confirming token was in SecureStore; Hypothesis 1 ruled out for this occurrence. Retry did nothing. Reconnect took user to Settings showing "Connected" (UX bug). Manual disconnect + reconnect fixed it. App still listed in Todoist → Preferences → Integrations, so token was not user-revoked. Root cause unknown — likely transient Todoist rejection. | Confirmed Hypothesis 2; UX bug identified |
| 2026-05-23 | Fixed Reconnect button (`CardDeck.tsx`) to clear stale token before navigating to Settings; added 401 response body logging to `services/todoist.ts` | Deployed |
| 2026-05-23 | Added on-screen display of Todoist 401 response body (`authErrorDetail` in deckStore, shown in CardDeck error screen) — replaces adb log approach | Needs new preview build |
| — | Next error occurrence: read detail text shown on error screen | Pending |
