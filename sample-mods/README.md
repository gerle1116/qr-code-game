# QR City Quest — Sample Mods

## core-spanish-preview.zip

**TEST ONLY — not a complete Spanish translation.**

This is a structurally complete **main-game** language pack used to test Step 4.
It copies the full trusted English game structure, translates the Merchant's first
dialogue, and translates several app interface labels. Most game dialogue and
many messages intentionally remain in English.

The preview pack has no `type` field. Its `manifest.js` declares
`target: "core"` and `languages: ["es"]`, so installing and enabling it
adds **español** to Settings → Language.

### Quick phone test

1. Keep your separately installed London expansion and London Spanish translation.
2. Install `core-spanish-preview.zip` in **Settings → Mods**.
3. Tap **Apply changes / Reload**.
4. Open **Settings → Language → español**.
5. The home screen should show **Aventura urbana (demo)**.
6. Scan original QR `02` to see the Merchant's sample Spanish greeting.
7. Scan `london:02` and check that your separate London Spanish pack translates
   London's dialogue.

The preview is safe for testing but should be **removed** after the test. It does
not provide a fully translated user experience. Your saved game progress remains
unchanged.

The test ZIP is automatically checked by `tests/test-mod-localization.js`.
