# Stage 7: GitHub adventure catalog

This is an online metadata discovery module, separate from the game. It never
loads encounters, fetches cover images or ZIPs, installs packages, reads storage,
registers a service worker or modifies an active adventure. No live app file loads
it. Existing offline gameplay and the mod system remain unchanged.

## Catalog structure and versioning

The production file is `adventure-catalog/catalog.json`:

```json
{ "catalogVersion": 1, "adventures": [] }
```

It is intentionally empty: no verified downloadable adventure packages are being
published in this stage. `adventure-system/samples/catalog/sample-catalog.json`
contains three fictional examples for development only. Their `example.invalid`
URLs, sizes and repeated-letter checksums are placeholders, not real packages.
Never copy them into the production catalog as downloadable adventures.

`schemas/catalog.schema.json` defines the JSON shape. `validateCatalog` implements
the same structural checks plus unique IDs, safe URLs, and normalization. Use the
runtime validator as well as the schema: schema validation alone does not prove
URL safety or ID uniqueness. Unknown fields are rejected. A future incompatible
format requires a new catalogVersion; version 1 loaders reject unsupported versions.
`catalogVersion` describes the catalog format; entry `version` describes a package.

Every entry requires these fields:

| Field | Rule |
| --- | --- |
| `id` | Unique, lowercase Stage 1 ID: starts with a letter, then letters/digits/hyphens; reserved prototype identifiers rejected |
| `version` | Numeric `major.minor.patch`, matching Stage 1 (no prerelease suffix) |
| `name`, `description`, `author`, `location` | Nonempty strings; display using `textContent`, never raw HTML |
| `language` | Exactly one code matching Stage 1, e.g. `en`, `hu`, `en-GB`; no arrays, comma-separated lists or extra `languages` field |
| `type` | `linear`, `circular`, `nonlinear`; existing Stage 1 spelling `non-linear` also accepted |
| `estimatedMinutes` | Positive safe integer |
| `minimumAge` | Nonnegative safe integer |
| `coverUrl` | Safe HTTPS URL whose path ends in `.png`, `.jpg`, `.jpeg` or `.webp` |
| `downloadUrl` | Safe HTTPS URL whose path ends in `.zip` |
| `packageSize` | Positive safe integer, size of the published ZIP in bytes |
| `sha256` | Exactly 64 hexadecimal characters, digest of the published ZIP bytes |

Normalized output uses Stage 1's canonical type `non-linear` for both accepted
spellings and lowercase checksums. It introduces no new gameplay type. Metadata
strings otherwise remain unchanged. Results are copies, so modifying them cannot
alter the original catalog.

URLs must be absolute HTTPS with no credentials, fragment, whitespace, backslash,
control character or nonstandard port. Localhost, `.local`, literal IP destinations
and invalid escaping are refused. Query strings are allowed; file extensions are
checked on the decoded path. Catalog request paths must end in `.json`; ZIP and
cover URLs cannot be passed to `fetchCatalog`. These checks validate references,
not remote file existence or contents. Hosting permissions and CORS still apply.
This is a browser client, not a server-side URL proxy; no DNS resolution or hosting
ownership verification is performed by the validator.

## GitHub hosting

The configured repository is `gerle1116/qr-code-game`.

Future production URL (raw file on `main`):

```text
https://raw.githubusercontent.com/gerle1116/qr-code-game/main/adventure-catalog/catalog.json
```

Development URL (independent `adventure-system` branch):

```text
https://raw.githubusercontent.com/gerle1116/qr-code-game/adventure-system/adventure-catalog/catalog.json
```

These are deployment targets, not a claim that this local work is published.
The development URL works once the file exists on the remote development branch;
the production URL works after a separately authorized release to `main`. Until
then, a 404 is expected. This stage does not push, merge or modify `main`.

`HOSTING`, `DEFAULT_CATALOG_URL`, `DEVELOPMENT_CATALOG_URL`, and `catalogURL()` keep
configuration in one module. For a dedicated repository:

```js
const url = QRCQAdventureCatalog.catalogURL({
  owner: 'your-account', repository: 'adventures', ref: 'main',
  path: 'adventure-catalog/catalog.json'
});
```

The helper supports simple branch names, tags and commit IDs. For refs containing
slashes, supply a correctly encoded raw HTTPS JSON URL directly to `fetchCatalog`.
Use raw-content/release URLs rather than GitHub HTML preview pages.

## API

CommonJS: `require('./adventure-catalog.js')`.
Browser: load `adventure-catalog.js`, then use `QRCQAdventureCatalog`.
No npm dependencies or gameplay modules are required.

```js
const checked = api.validateCatalog(localJSON);
if (!checked.ok) console.error(checked.code, checked.message, checked.errors);

const result = await api.fetchCatalog(api.DEVELOPMENT_CATALOG_URL, {
  timeoutMs: 10000,
  fetch: window.fetch.bind(window) // optional injected implementation
});
if (result.ok) {
  const entries = api.getAdventures(result.catalog);
  const one = api.getAdventureById(result.catalog, 'some-adventure'); // null if absent
  const filtered = api.filterAdventures(result.catalog, {
    type: 'circular', language: 'hu', search: 'wizard', location: 'Hungary',
    maxMinimumAge: 10, sortBy: 'duration', order: 'asc'
  });
}
```

`validateCatalog` and `fetchCatalog` return `{ok:true,catalog}` on success, including
an empty catalog. Failures return `{ok:false,code,message,errors}`; no partially
validated entries escape. Validation does no fetching. `getAdventures`,
`getAdventureById`, and `filterAdventures` revalidate input and return independent
data; invalid catalogs/filters throw `TypeError` rather than looking like empty
results. Validation errors carry field paths. Data-operation catalog exceptions
also expose `error.code`.

Fetching makes one catalog request, with credentials omitted, redirects refused,
and `cache:'no-store'`. A timer covers both response headers and body and aborts the
request; injected fetches that ignore abort still return a timeout result. The
default timeout is 10 seconds. It must be a positive integer at most 2147483647.
JSON text longer than 2 MiB of characters is rejected after reading the body;
this is not a streaming response-size limit. No catalog or adventure cache is
created. Error codes include:

| Code | Meaning |
| --- | --- |
| `INVALID_URL`, `INVALID_OPTIONS` | Request configuration rejected before fetching |
| `NETWORK_UNAVAILABLE` | No usable fetch implementation |
| `NETWORK_ERROR` | Offline, connection/CORS/redirect or response-read failure |
| `TIMEOUT` | Request or body exceeded the deadline |
| `CATALOG_NOT_FOUND` | HTTP 404 |
| `HTTP_ERROR` | Other unsuccessful HTTP response |
| `INVALID_JSON` | Response cannot be parsed as JSON |
| `UNSUPPORTED_VERSION` | Unsupported catalogVersion |
| `INVALID_CATALOG` | Invalid structure/metadata, duplicates or oversized response |

Failures return metadata errors only; there is no reference to active gameplay,
installed mods or saves to delete or reset.

## Filtering and sorting rules

Filters combine with AND. Empty text filters do nothing. Type matches exactly
after normalizing `nonlinear`; language matches the full code case-insensitively.
Search is a case-insensitive substring across name and description, location is
a case-insensitive substring of location; both trim the search term. Matching does
not strip accents. `maxMinimumAge:10` shows entries with recommended minimum age
at most 10; it does not filter for adventures requiring players to be at least 10.

Without `sortBy`, catalog order is retained. `sortBy:'name'` uses deterministic
lowercase string ordering; `sortBy:'duration'` uses estimated minutes. Equal values
are ordered by ID. `order:'desc'` reverses that ordering; default is `asc`. Unknown
filter options, types, sort names, order values and invalid ages are rejected.
All operations copy entries and leave input untouched.

## Open the standalone tester in VS Code

The tester needs a local HTTP server to fetch the sample JSON. Double-clicking the
HTML file as `file:///` may fail due to browser security rules.

1. Open this repository folder in VS Code.
2. Select **Terminal → New Terminal**. Use PowerShell and ensure the terminal is
   in the repository root.
3. On this Windows machine, paste these two commands:

   ```powershell
   $env:ELECTRON_RUN_AS_NODE = '1'
   & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tools/serve-adventure-catalog.js | Out-Host
   ```

   With Node installed on PATH, use `node tools/serve-adventure-catalog.js` instead.
   No installation step is needed. The existing Python server scripts can also
   serve the repository if Python is installed. VS Code's Live Server extension
   is another option: right-click `catalog-tester.html` → **Open with Live Server**.

4. Open **http://127.0.0.1:8000/adventure-system/catalog-tester.html** in Chrome or Edge.
5. The three fictional samples load automatically. Try the search, type, language,
   location, player-age and sorting controls.
6. For GitHub metadata, click **Use development URL**, then **Load online catalog**.
   **Use future production URL** selects `main` independently. You can also paste
   another safe HTTPS JSON catalog URL. Unpublished branch files return a clear 404.
7. Stop the server with **Ctrl+C** in its terminal. If port 8000 is occupied, stop
   the other server or use Live Server.

The helper server binds to localhost and serves only standalone adventure/test
resources. It does not serve `app.js`, the live app, `.git` or original game data.
The tester shows names, descriptions, authors, language, type, location, ages,
duration and version using safe DOM text. Sample and online sources are labeled
separately. It has no functional download buttons or remote cover elements.
Online availability is not verified merely by displaying metadata.

## Tests and future publishing

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
& "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tests/test-adventure-catalog.js --browser | Out-Host
```

Or use `node tests/test-adventure-catalog.js --browser`. Without `--browser`, only
the Node suite runs (it also tests the localhost helper). Browser mode uses actual
headless Chrome with a temporary profile and localhost server, removed/stopped
afterward; set `QRCQ_TEST_BROWSER` to another Chromium executable if needed.
Browser tests load actual sample JSON and the actual tester. Online responses are
injected to exercise success, HTTP/offline/JSON errors deterministically; passing
these tests does not claim that unpublished GitHub endpoints are reachable.

Eventually, creators will validate an adventure package with Stage 1, publish a
real ZIP and cover on GitHub, calculate the actual ZIP byte count and SHA-256, and
submit matching metadata for review before adding it to the production catalog.
Never publish placeholder references as real packages. Publication is a separate
explicit action, not part of this stage.

Stage 8 can consume normalized catalog entries to download and verify actual
bytes, compare size/checksum, validate archive contents and store packages safely.
Those operations, installation, activation, switching and the live browsing
interface are intentionally not implemented here. Catalog checksums currently
validate format only, since Stage 7 never reads ZIP bytes.

## Verification on 2026-11-17

Stage 7: 127 Node checks plus one browser-harness check passed (128 reported by
the runner), zero failed. The browser harness executed 18 additional DOM checks,
all passing. Stage 1–5 passed 96/85/64/89/50 respectively, all with zero failures.
Stage 6 reported 27 passes including its browser harness; its 22 browser checks
also passed. Mod runtime passed 10 and installer passed 14. Localization passed
12 before the documented Spanish preview ZIP mismatch failed:
`core:es.encounters: keys differ; core:es.items: keys differ`.
No real GitHub fetch or publication is claimed; browser online tests used injected
responses. All original gameplay and Stage 1–6 source files remain unchanged.
