# Stage 12 final audit

## Initial checklist

The clean starting point was branch `adventure-system` at
`cfef2cb7915c47ea1429382324bc17e6b6da9681`. The local `main` reference was
`913db42d5e6a8958177f07ebed56528897e9180f`. The tracked `debug.log`, testers,
sample ZIPs and release harnesses belong outside the production artifact.

- Trace read, migration, write, restart and failure paths for the one active record.
- Follow actual entry points through QR authorization and revision-checked mutation.
- Audit catalog, ZIP, JSON, image and rendering boundaries before exercising installs.
- Check version coupling, interrupted updates, subdirectory scope and offline recovery.
- Run the original suites and a release browser suite in disposable profiles.
- Record production and physical-device evidence separately and leave deployment pending.

The stage descriptions and per-stage briefs are the traceability sources. No separate
canonical twelve-stage plan was located in the tracked tree. The table distinguishes
observed implementation from behaviors that still need release evidence.

| Stage | Implemented as planned | Contradiction, addition, gap or verification limit |
|---|---|---|
| 1 Format | `validator.validateFiles` and v1 schemas check owners, references, conditions and completion reachability. | Timer and scan-handoff destinations have a stricter same-owner runtime rule than structural validation. Keep those links inside their encounter. Stage 12 adds bounded image geometry as a package resource policy. |
| 2 Linear | `scenario-engine` locks the first eligible scenario and persists an ordered checkpoint prefix. | Out-of-order `allow` permits local navigation and deliberately excludes every persisted mutation. Stages 2/3 distinguish access from progression permission. |
| 3 Authorization | `qr-resolver` owns live permissions. `choose` verifies view identity and resolver authority. | The Stage 10 standalone checkpoint control remained reachable on live sessions. Stage 12 excludes it from live play. |
| 4 Saves | `adventure-save`, `adventure-integration.start`, and `adventure-storage.updateSave` migrate and verify one authoritative record. | Editing game data in DevTools falls outside this same-origin client boundary. Physical power loss, eviction and an already-open pre-migration tab are unverified. |
| 5 History | Stage 5 supplies persisted counts and restricted condition evaluation. | No hidden fixed circular route. Long-run visit/storage performance is unverified. |
| 6 Maps | `map-renderer` renders installed maps and disposes listeners. Active asset leases dispose blob URLs on unload. | Physical pinch, screen readers and broad mobile landscape coverage are unverified. |
| 7 Catalog | Stage 7 validates HTTPS catalog URLs and metadata. Live remote origins select the production catalog. | The checked-in production catalog is intentionally empty. Hosted responses, headers and real package URLs are unverified. |
| 8 Install | `adventure-downloader`, `adventure-zip` and Stage 8 storage bind an atomic install to the expected revision. | Download redirect handling retains Stage 8's GitHub release compatibility. Fetch validates the final response URL. Intermediate hops are not visible to application JavaScript. |
| 9 Browser | Search, details, progress, replacement and cancel are wired into the live shell. | Native keyboard and mobile-width tests exist. Assistive-technology and large-catalog performance are unverified. |
| 10 Completion | The authorized ending commits before victory. Replay confirms and uses the same save slot. | The optional timestamp and standalone tester were additions. Standalone checkpoint confirmation remains available only to standalone sessions. |
| 11 Integration | Live original and downloaded routes, storage, mod isolation, language separation and offline shell are exercised by integration tests. | The old shell could mix navigation generations on update. The v42 worker addresses that for v42 and subsequent compatible shells. Full original story, legacy overdue-item paths and physical camera lifecycle still need manual coverage. |

## Findings and corrections

| Severity / finding | Reproduction and root cause | Correction and evidence |
|---|---|---|
| High, mixed shell generation | With v41 controlling, request a navigation while the server serves a future document. Network-first HTML can refer to a generation that has not installed. | `sw.js` serves the installed shell first, checks versioned assets in their generation, retains two previous generations, and activates only after required assets cache. Release browser tests exercise the future-HTML boundary, failed precache and retry under `/qr-code-game/`. |
| High, live checkpoint shortcut | Open a live linear encounter and invoke `confirmCheckpoint` without completing the dialogue. The method was shared with the standalone tester. | `adventure-completion.js` denies the shortcut in live sessions. Release Node tests cover authorization and a stale write after reinstall. |
| High, catalog environment mismatch | Open Adventures on a non-loopback host. `app.js` previously selected the development branch. | The live app now selects the production URL on non-loopback origins. Loopback testing still uses the development URL. Hosted response verification remains open. |
| High, unbounded native image geometry | A package can contain an image with small compressed size but dimensions much larger than its byte budget implies. Header signature checks did not bound decode size. | `validator.js` checks PNG, JPEG and WebP geometry before native decoding or installation, including unreferenced images. The maximum is 4,096 pixels per edge and 12 million pixels per image. Stage 12 checks over-limit rejection and unchanged sample compatibility. Animated-image work and large-package peak memory still need profiling. |
| Medium, outdated Spanish preview | The shipped preview lacked encounter `45`, item `Crystal Book`, `defaultPicture` on six items, and `picture` on book pages `4001`, `4009`, `4301`, and `4309`. | The preview ZIP uses current English fallback data for those exact keys. Existing Spanish preview text is preserved. The core validator is unchanged and the original localization test checks the updated ZIP. |
| Medium, public debug query | Loading a non-local deployment with `?debug=1` exposed local developer overrides. | `app.js` limits the query shortcut to loopback and preserves the existing secret debug preference and activation paths. |

Stage 8 bounds compressed bytes and file count, checks ZIP paths and collisions,
rejects ambiguous or unsupported structures, and verifies CRC and exact lengths.
SHA-256 is checked before extraction and catalog metadata is compared to the
manifest before staging. Only trusted application code supplies test transports,
decoders or other loader overrides. A publisher controlling the catalog and ZIP
can supply both a package and its matching hash. Integrity alone cannot certify
the authorship, puzzle correctness or resource cost of that package.

## Outstanding evidence

- Physical Android Chrome, iPhone Safari, installed PWA lifecycle, physical
  QR scanning and background camera behavior are **NOT VERIFIED**.
- Production CORS, live Pages deployment and authorized hosted ZIP/cover downloads
  are **NOT VERIFIED**. The GitHub repository API returned the empty catalog on
  `adventure-system` and a 404 for that path on `main`. Raw content and Pages
  responses could not be verified through the available connection.
- The compatibility harness uses a previous worker registration fixture. Upgrade
  from the literal deployed v40 asset set with a populated real-world save, and
  an already-open v40 tab, still require isolated preproduction verification.
- A complete unguided original-game playthrough, all original NPC/item paths,
  sustained large-catalog/install/load measurements and manual accessibility
  verification remain open. Developer-jump victory, isolated timer fixtures and
  simulated tab failures do not close those gates.
- Existing test installs with artwork larger than the new geometry limits
  can require an author-supplied compatible package. A failed validation leaves
  the stored record intact. No production package inventory was available to scan.
- Desktop browser offline emulation and transaction aborts establish behavior
  under those conditions. Device power loss, browser eviction and private
  browsing retention were outside the tests.
