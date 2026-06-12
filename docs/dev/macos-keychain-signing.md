# macOS dev code-signing — stop the keychain prompt on every launch

## The symptom

On macOS, launching the dev app repeatedly shows:

> "Pragna" wants to use your confidential information stored in "com.pragna2.app"
> in your keychain.

…on **every** launch, even after clicking **Allow**.

## Why it happens

The app stores the Auth0 **refresh token** in the OS keychain to keep you logged
in across restarts (TD-009). At startup it reads that token back — which is the
operation macOS guards with the prompt.

macOS ties a keychain item's "trusted apps" list (its ACL) to the requesting
app's **code signature**. Dev builds are *ad-hoc* signed, and an ad-hoc signature
is just a hash of the binary. Every relink produces a new hash → macOS sees a
"new app" → it re-prompts, and a previous **Always Allow** no longer matches.

This is purely a **development** artifact:

- In a **packaged/released** build the binary never changes on the user's
  machine, so the prompt appears **once** and **Always Allow** sticks — no
  certificate required.
- It only repeats in **dev** because each rebuild re-signs ad-hoc.

It is **not** a storage-design problem. Moving tokens to a local DB/file is
weaker than the keychain; moving them to the backend is impossible without still
storing a bootstrap secret locally (you can't reach the backend without one).
The keychain is the correct home — the prompt just needs a *stable* signature.

## The fix: a free self-signed code-signing certificate

You do **not** need a paid Apple Developer account. A locally created,
self-signed code-signing certificate is enough to give the dev binary a **stable
designated requirement**:

```
designated => identifier "com.pragna2.app" and certificate leaf = H"<cert hash>"
```

The keychain grant keys off this requirement — the **bundle identifier + the
certificate**, *not* the binary hash. So once you click **Always Allow**, it
keeps matching across every future rebuild, as long as the binary is re-signed
with the same cert.

[`scripts/macos-dev-codesign.sh`](../../scripts/macos-dev-codesign.sh) automates
this. It is idempotent and a no-op off macOS:

1. Creates the self-signed identity **"Pragna2 Dev Code Signing"** in your login
   keychain (once).
2. Re-signs `src-tauri/target/debug/pragna2_desktop_app` with it.

## Usage

**Recommended — build, sign, then run in one command (macOS):**

```sh
pnpm tauri:dev:signed
```

**Or sign an already-built binary, then run dev as usual:**

```sh
pnpm sign:dev      # ensures the cert exists + signs the current dev binary
pnpm tauri dev
```

**On the very first signed launch, click "Always Allow"** (not "Allow"). After
that the prompt will not return.

### When does the prompt come back?

Only when the Rust binary is **relinked** (you changed Rust code, ran
`cargo clean`, or bumped a Rust dependency) — that strips the cert signature back
to ad-hoc. Re-sign and relaunch:

```sh
pnpm sign:dev      # re-signs; reproduces the SAME designated requirement
```

Because the designated requirement is identical, your existing **Always Allow**
grant still applies — re-signing does **not** trigger a new prompt. Frontend-only
work never relinks the binary, so it never re-prompts.

## Notes & scope

- **macOS only.** Windows Credential Manager does not prompt this way; the script
  is a no-op there and `pnpm tauri dev` is used as normal.
- **Local dev only.** The cert is self-signed and untrusted for distribution
  (`CSSMERR_TP_NOT_TRUSTED` in `find-identity` is expected and harmless here). It
  has no effect on a packaged/notarized release and is not a substitute for a
  Developer ID certificate.
- **Graceful fallback already in place (CF-007):** even if you dismiss the
  prompt, the app degrades to "no saved session" and sends you to login rather
  than erroring.
- **Removing the cert:** delete the **"Pragna2 Dev Code Signing"** identity from
  *Keychain Access*, or:
  ```sh
  security delete-identity -c "Pragna2 Dev Code Signing"
  ```
