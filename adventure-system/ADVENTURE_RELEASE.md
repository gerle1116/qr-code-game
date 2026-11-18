# QR City Quest Stage 12 release candidate

**Recommendation: NO-GO for production.** Candidate **Stage 12 RC1**, shell
`qr-city-quest-v42`. The same generation is referenced by the HTML, language
loader, live app and service worker. Physical camera and installed mobile PWA
behavior, production hosting, and the full original-story acceptance pass are
release gates. The remaining evidence is listed in [the final audit](FINAL_AUDIT.md).

## Local review

```powershell
git status --short
git branch --show-current
git diff --check
git diff cfef2cb7915c47ea1429382324bc17e6b6da9681
git log --oneline main..adventure-system
node tools/serve-integrated-game.js
# In a separate terminal
node tests/test-adventure-release.js --browser
node tests/test-adventure-integration.js --browser
```

Open `http://127.0.0.1:8000/` in a new development-browser profile. See the
[release checklist](RELEASE_CHECKLIST.md) for the device and hosting matrix.

## Verification record

| Suite | Pass | Fail |
|---|---:|---:|
| Stages 1–5 Node, respectively | 96 / 85 / 64 / 89 / 50 | 0 |
| Stages 6–11 Node, respectively | 26 / 127 / 82 / 27 / 26 / 11 | 0 |
| Stages 6–11 Chromium, respectively | 22 / 18 / 20 / 48 / 17 / 14 | 0 |
| Stage 12 Node | 4 | 0 |
| Stage 12 Chrome | 5 | 0 |
| Stage 12 Edge | 5 | 0 |
| Mod runtime / installer / localization | 10 / 14 / 13 | 0 |

Counts exclude wrapper assertions and avoid double-counting the same Stage 12
Node run under two browser selections. Four Stage 12 checks per browser cover
the prior worker registration, a failed precache, activation/recovery and
offline reopening under `/qr-code-game/`. The fifth plays the original Hunter
route and tests persisted timer state, the fountain hint and feather pickup.
Some initial Windows browser runs hit startup deadlines or profile locks. The
listed Chromium suites passed on sequential reruns. Firefox, physical device
tests and hosted package tests were not executed. The obsolete Python build
checker was not executed because its required `data/game-data.json` is absent.

## Rollout plan for after approval

1. Close the release gates. Inspect the candidate diff, test outputs, production
   artifact and catalog. Build a deployment allowlist containing just the app
   shell, adventure runtime modules, built-in and mod scripts, icons, images,
   manifest and reviewed production catalog. Exclude tests, standalone testers,
   sample ZIPs, authoring tools and `debug.log`. Deploy the identical artifact to
   an approved HTTPS staging origin under `/qr-code-game/`.
2. On approval, record the verified release commit. Record the current deployed
   commit and artifact, then tag the recovery point locally. Do this before the
   production merge. Review the tag and branch references independently.

   ```powershell
   git fetch origin
   git rev-parse origin/main
   git tag -a qrcq-pre-adventure-v42 origin/main -m 'QR City Quest pre-v42 recovery point'
   git show --no-patch qrcq-pre-adventure-v42
   ```

3. Review the pull request from `adventure-system` to `main`. Require final
   approval before merging. Use the repository's reviewed Pages configuration
   to publish the allowlisted artifact. Confirm the published commit and worker
   scope. Verify a fresh disposable profile and a retained staging profile with
   a seeded old save, installed mods and old language preferences. Check active
   registration, shell assets, original NPC and item scans, migration,
   revision-checked saves, and reopening offline.

   After explicit approval and after the reviewed candidate is committed and
   pushed to the development branch:

   ```powershell
   gh pr create --repo gerle1116/qr-code-game --base main --head adventure-system --title 'QR City Quest Adventure System v42'
   gh pr checks <PR-number> --repo gerle1116/qr-code-game
   gh pr merge <PR-number> --repo gerle1116/qr-code-game --merge
   ```

   Use the repository's authorized merge method if branch protection requires a
   different strategy. Inspect the resulting Pages deployment before marking the
   rollout healthy.
4. Watch for startup errors, worker install failures and failures to open or
   migrate the active save. Pause rollout when a required check fails. Preserve
   the exact failing origin, worker version, console error and package metadata.
   Use authorized copies of synthetic test saves for diagnosis.

## Rollback

Prefer a forward-compatible repair over serving the old localStorage-only app
after migration. Stop future activation and prepare a fresh shell generation
from the last known good integrated app, preserving IndexedDB namespace,
revision handling and save compatibility. Rehearse this using a migrated
disposable record with newer gameplay. A Git revert changes code only.
Keep IndexedDB, mod storage and the untouched legacy backup. Never clear site
data or automatically restore the legacy backup over a newer active record.
If an old shell cannot read current data, recovery needs a deliberately
reviewed compatibility build. An old code tag is an artifact checkpoint.

## Future adventure publication

Publish only approved packages. Validate the source directory with
`node adventure-system/validator.js <package-directory>`. Build the ZIP from
reviewed assets and JSON. Record exact byte size with `(Get-Item <zip>).Length`
and SHA-256 with `Get-FileHash -Algorithm SHA256 <zip>`. Verify catalog and
manifest identity, version, type, language, title, description and other
metadata. Stage the exact bytes on approved HTTPS hosting. Check browser CORS,
the final response URL, cover availability and integrity in a disposable
profile. Publish the authorized catalog update only after that verification.
