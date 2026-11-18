# Release gates

## Automated

- [ ] Run every `tests/test-*.js` runner. Add `--browser` for map, catalog,
  downloader, browser, completion, integration and release. Record counts per
  suite and check unchanged baseline data. Pass means zero unexpected failures.
- [ ] Review all stage contracts and the artifact allowlist. Pass means only
  trusted runtime resources ship, the cache generation agrees across files,
  and the production catalog contains only approved entries.
- [ ] In disposable profiles, compare legacy data before migration and after
  reopening. Pass means the full active save is readable and the legacy
  storage string remains byte-for-byte unchanged.
- [ ] Exercise revision races, failed saves, interrupted install, rejected
  packages, replacement cancel and future-shell precache failure. Pass means
  no partial pair, stale commit, unexpected clear or mixed shell.

## Desktop Chrome, Edge and Firefox

- [ ] Use a disposable profile at `http://127.0.0.1:8000/` and repeat under the
  approved HTTPS subdirectory. Record product and version. Test keyboard and
  pointer, phone and desktop widths, visible focus, dialog cancellation,
  screen-reader announcements and reduced-motion preference.
- [ ] Complete the original story in English and Hungarian. Include every
  NPC, physical-item collection and reuse, Hunter's timer and feather hint,
  the library overdue-item redirects, inventory dropdowns, conditions,
  counters, castle access, victory and replay. Repeat with a supported mod.
- [ ] Play both linear scenarios and the circular and non-linear samples in
  isolated contexts. Confirm map/objectives, item and quest state, read-only
  paths, persisted victory, old-save migration, offline reload and replay.

## Physical Android

- [ ] Use an approved HTTPS test origin accessible from the handset. Use a
  trusted certificate and disposable browser data. Do not use the computer's
  localhost address from the handset. Record Android and Chrome versions.
- [ ] Scan real encounter and item QRs in browser mode and installed PWA.
  Allow, deny and revoke camera access. Background and resume with the scanner
  open. Pass means tracks stop when leaving, resume safely when appropriate,
  and manual entry works when camera or decoder is unavailable.
- [ ] Verify touch, portrait and landscape, install, reopening offline,
  persisted timers, completion, replay and saved state after relaunch.

## Physical iPhone

- [ ] Repeat the physical QR, permission, touch and persistence matrix in Safari
  and as a home-screen app on the approved HTTPS origin. Record iOS and Safari
  versions, and verify camera fallback and offline relaunch in each mode.

## Hosting and approval

- [ ] On approved staging, verify both configured catalog URLs and CORS,
  scoped Pages paths, asset and ZIP checksums, cover access and empty-state UI.
  Test one authorized hosted package when available.
- [ ] Repeat the actual deployed v40-to-candidate upgrade with synthetic legacy
  progress and a second old tab. Test a failed update followed by recovery and
  a compatible rollback. Pass means preserved progress and a usable shell.
- [ ] Record a reviewed diff, recovery point and approved candidate commit.
  Obtain explicit release authorization before touching `main`, Pages or
  published catalog entries.
