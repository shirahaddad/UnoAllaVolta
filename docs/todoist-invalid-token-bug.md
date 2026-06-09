# Todoist Auth Errors — Diagnosis & History

## Current architecture (as of 2026-06-09)

| File | Role |
|------|------|
| `store/authStore.ts` | Stores access token + refresh token in SecureStore; loads on app start and foreground |
| `services/todoist.ts` | Throws `TodoistAuthError(body, errorCode, retryAfter, errorTag, requestId)` on HTTP 401; exports `refreshTodoistToken()` to exchange refresh token for new access token |
| `store/deckStore.ts` | Calls `fetchTasks`/`fetchProjects`; on `TodoistAuthError` with `errorCode 477`, attempts token refresh via `refreshTodoistToken()` and retries once with new token; saves the last successful deck to SecureStore (`cached_deck_v1`) |
| `app/_layout.tsx` | On startup calls `loadCachedCards()` so cached deck is shown before any network fetch; also calls `loadFromStorage` on AppState foreground transition |
| `components/CardDeck.tsx` | Shows spinner/error screens only when `queue.length === 0` (no cache); otherwise shows cached cards while background refresh runs |

### How a 477 is handled today

Per Todoist docs: 477 means the access token has expired. Do NOT retry the same token — exchange it for a new one first.

1. `services/todoist.ts` reads the response body, parses it, and throws `TodoistAuthError(rawBody, errorCode, retryAfter, errorTag, requestId)`.
2. `deckStore.fetchCards` catches it:
   - If `errorCode === 477` and this is the first attempt (`retryCount === 0`): call `refreshTodoistToken()` with the stored refresh token.
     - If refresh succeeds: store the new access token and retry the full fetch once (`retryCount=1`). User sees no error — cached cards stay visible.
     - If no refresh token or refresh fails: fall through to surface the error.
   - Otherwise: set `error: 'invalid_token'` and `authErrorDetail` with the raw response body.
3. `CardDeck.tsx` only shows the error screen if `queue.length === 0` (no cached cards). If cached cards exist, the reconnect banner is shown instead.

### Note on done/later during a 477 window

`markDone` calls `closeTask` fire-and-forget. If this fails during a 477 (before the token is refreshed), the task stays open on Todoist. After the token refresh and fresh fetch, the "done" task will reappear at the end of the queue. This is a known limitation.

### What the error screen shows (when it does appear)

| Message | Meaning |
|---------|---------|
| **"Todoist disconnected"** | `tokenFoundInStorage === false` — SecureStore returned null; token was lost |
| **"Todoist session error"** | Token was present but Todoist returned 401 |

The raw JSON from Todoist is shown below the subtitle. "Retry" retries immediately. "Reconnect Todoist" clears the token and navigates to Settings.

---

## Known error codes

### error_code 477 — access token expired
```json
{"error":"Unauthorized","error_code":477,"error_extra":{"event_id":"d32c2b1ca7e7439cb7e3ba1cff9d165f","retry_after":9},"error_tag":"UNAUTHORIZED","http_code":401}
```
Per Todoist docs: the access token has expired or been invalidated. **Do not retry with the same token.** `retry_after` is backoff metadata for after obtaining a new token, not a signal to wait and retry. `error_extra.event_id` is a Todoist trace ID — include it when filing a Todoist support ticket. The app now handles this by exchanging the stored refresh token for a new access token, then retrying once.

### error_tag AUTHZ_PERMISSION_DENIED — permanent
Token has been revoked (user disconnected in Todoist → Settings → Integrations → Connected apps, or changed password). Requires reconnect. No `retry_after` field.

---

## Diagnosing a new error

### Step 1 — Use the "Test connection" button in Settings

Open **Settings → TODOIST → Test connection**. This makes a live `GET /projects` call and shows the result inline without touching the card queue:
- `✓ OK — N projects` → token is valid; the issue is elsewhere (UI bug, stale state)
- `✗ <error body>` → token is genuinely rejected; read the body for the `error_tag`

If "Connection error" appears next to the dot in Settings, the raw Todoist JSON is shown there too.

### Step 2 — Read the error detail

The `error_tag` field tells you the rejection category:

| `error_tag` | Meaning |
|-------------|---------|
| `AUTHZ_PERMISSION_DENIED` | Token revoked. Tap Disconnect → reconnect. |
| *(empty / unparseable)* | Unusual. Check `error_code` and `retry_after`. |

If `retry_after` is present → transient; the app retries automatically up to 4×. If it keeps coming back, the 4-retry cap may need raising.

### Step 3 — ADB logs (needs USB cable)

```
adb logcat | grep ReactNativeJS
```
Look for the `[todoist] 401:` line — it now logs `{ endpoint, errorCode, errorTag, requestId, body }`:
- `requestId` is Todoist's `X-Request-Id` header — include this when filing a Todoist support ticket
- `[authStore] loadFromStorage todoistToken: null` → SecureStore key invalidation (Hypothesis 1)
- `endpoint` shows which call failed first (`/tasks` vs `/projects`)

### Step 4 — Read the heading (error screen only, no calendar fallback)

- "Todoist disconnected" → `tokenFoundInStorage === false`; SecureStore lost the key. See Hypothesis 1.
- "Todoist session error" → Token present but rejected.

---

## Hypotheses for persistent errors

### 1. Android SecureStore key invalidation

`expo-secure-store` on Android uses `EncryptedSharedPreferences` backed by Android Keystore. Certain events silently invalidate stored keys:
- Changing lock screen PIN, fingerprint, or face unlock
- Some Android OS security updates
- Factory-resetting biometrics

`SecureStore.getItemAsync` returns `null` without throwing. The app then sends `Authorization: Bearer null`, and Todoist responds with 401. The error screen shows "Todoist disconnected."

**Potential fixes (not yet implemented):**
1. Add `keychainService` to all SecureStore calls for namespace consistency.
2. Store a `was_connected` flag in plain storage; if SecureStore returns null but `was_connected` is true, prompt reconnect proactively.

### 2. Token expiry (confirmed root cause of persistent 477s)

Error 477 means the access token has expired. Previous analysis treated this as a transient rate limit to wait out, but Todoist docs explicitly say: do not retry the same token — refresh it first. The app was retrying 4× with the same expired token, which always fails. Fixed by implementing token refresh on 477.

### 3. Race condition on app resume *(low probability)*

`useFocusEffect` in `CardDeck` fires `fetchCards` when the screen gains focus. `loadFromStorage` in `_layout.tsx` also fires on foreground. If `fetchCards` wins and `todoistToken` is still `null` in memory, the call is skipped entirely (empty deck shown, no error). Not the cause of 401 errors, but explains blank-deck-on-resume if it ever recurs.

---

## Status history

| Date | Action | Outcome |
|------|--------|---------|
| 2026-05-21 | Removed token auto-clear on 401; added SecureStore read-back verification; added AppState listener (`b28cbd8`) | Deployed |
| 2026-05-21 | Added `tokenFoundInStorage` to authStore; error screen distinguishes "session lost" vs "session error" | Deployed |
| 2026-05-23 | Error occurred — "Todoist session error" confirmed (token in SecureStore, not user-revoked). Retry did nothing. Reconnect navigated to Settings showing "Connected" (UX bug). Manual disconnect + reconnect fixed it. | Hypothesis 1 ruled out; UX bug identified |
| 2026-05-23 | Fixed Reconnect button to clear stale token before navigating; added on-screen 401 response body display (`authErrorDetail`) | Deployed |
| 2026-06-02 | Error occurred after reinstall — error_code 477 with retry_after:5. Transient token propagation delay. Added `errorCode`/`retryAfter` to `TodoistAuthError`; deckStore silently retries up to 4× | Deployed |
| 2026-06-03 | Persistent 477s caused spinner to show for 15+ seconds. Added deck card caching (`cached_deck_v1` in SecureStore); error/spinner screens now suppressed when cached cards exist; retries continue silently in background | Deployed |
| 2026-06-06 | Todoist 401 aborted calendar fetch; queue showed stale cards with no counter and no recovery path. Fixed: Todoist and calendar fetches now independent; `todoistDisconnected` state surfaces a reconnect banner without hiding calendar cards. Added `errorTag` + `requestId` to `TodoistAuthError`; settings shows live connection health + "Test connection" button | Deployed |
| 2026-06-09 | 477 error persisting every time app is opened after ~1h inactivity. Diagnosed as token expiry, not rate limiting — Todoist docs confirm 477 requires token refresh, not same-token retry. Previous retry loop was wrong. Implemented: `refreshTodoistToken()` in todoist.ts; on 477, deckStore exchanges refresh token for new access token and retries once silently. If no refresh token or refresh fails, reconnect banner shown immediately (no wasted retries). | Deployed |
