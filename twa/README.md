# FriendlyBet — Google Play (TWA) package

This folder builds the **Android app** that publishes FriendlyBet to the Google Play Store.
It is a **Trusted Web Activity (TWA)**: a thin Android wrapper that opens the live website
(`https://friendlybet.live`) full-screen, with no browser UI. **No app code is rewritten** —
the app *is* the website. Updating the site updates the app instantly.

> This folder is excluded from the Vercel deploy (see `.vercelignore`) — it never touches the
> live site. The only site-facing files are `manifest.json` and `.well-known/assetlinks.json`.

---

## One-time facts

- **Package ID (applicationId):** `live.friendlybet.app`  ← must match `.well-known/assetlinks.json`
- **Website:** `https://friendlybet.live`
- **Play Console fee:** $25 one-time (personal account is fine to start)

---

## Build steps (Bubblewrap)

Prereqs: Node 18+ and a JDK (Bubblewrap installs the Android SDK itself).

```bash
# 1. install Google's official CLI
npm install -g @bubblewrap/cli

# 2. from this folder, init from the live manifest
#    (twa-manifest.json here is a starter; `init` will confirm/overwrite fields)
bubblewrap init --manifest=https://friendlybet.live/manifest.json

# 3. build the release artifact
bubblewrap build
#    -> produces app-release-bundle.aab  (this is what you upload to Play)
#    -> also produces app-release-signed.apk for local testing
```

`bubblewrap init` will create/keep a **signing keystore** (`android.keystore`). Keep it safe and
backed up — **OR** (recommended) let **Play App Signing** manage the key (Play Console offers this
on first upload; then Google holds the upload+app key).

### No-terminal alternative
Go to **https://www.pwabuilder.com**, paste `https://friendlybet.live`, choose **Android / Google
Play**, set the Package ID to `live.friendlybet.app`, and download the generated `.aab` + the
`assetlinks.json` snippet. Same result, zero CLI.

---

## CRITICAL: paste the signing fingerprint back into the website

After the first build (or after Play App Signing is enabled), get the **SHA-256 fingerprint** of the
key that signs the app:

```bash
# Bubblewrap prints it, or:
keytool -list -v -keystore android.keystore -alias android | grep SHA256
```

If you use **Play App Signing** (recommended), the fingerprint to use is the one shown in
**Play Console → Setup → App integrity → App signing key certificate (SHA-256)**.

Then edit `../.well-known/assetlinks.json` and replace
`REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT` with that value
(format `AA:BB:CC:...`, 32 hex pairs), commit, and let Vercel deploy.

Verify it's live and correct:
```
https://friendlybet.live/.well-known/assetlinks.json
```
and validate with Google's tester:
```
https://developers.google.com/digital-asset-links/tools/generator
```
If this fingerprint is wrong/missing, the app shows an ugly URL bar at the top. That's the #1 mistake.

---

## Play Console checklist (personal account)

1. Pay the $25, create the app, set name (he/en) + package `live.friendlybet.app`.
2. Upload the `.aab` to a **Closed testing** track.
3. Add **12+ testers** (real Gmail addresses), send them the opt-in link → each installs once.
4. Wait **14 consecutive days** (the testers don't need to keep using it after installing).
5. Apply for **production** → Google review (~2-5 days) → app goes live publicly.
6. Fill: privacy policy URL, data-safety form, content rating. (Free, no money, no ads = simple.)

Store-listing assets needed: 512×512 icon (have it), a 1024×500 feature graphic, 2-8 phone
screenshots, short + full description (he + en — drafts can be generated).

---

## After launch: the in-app "Rate us" funnel

Once live, add the **Play In-App Review API** (or a deep link to
`https://play.google.com/store/apps/details?id=live.friendlybet.app`) behind a success moment
(climbed the leaderboard / nailed a prediction). That turns engaged users into Play ratings —
which then surface as ⭐ in Google Search.
