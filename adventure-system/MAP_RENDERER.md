# Stage 6: custom adventure maps

`map-renderer.js` is a standalone CommonJS/browser module. It has no gameplay,
scanner, scenario engine, save, storage, network API or third-party dependency.
The live app does not load it. Load `map-renderer.css` alongside it.

## API

```js
const result = QRCQMapRenderer.createMapRenderer({
  container: document.getElementById('map'),
  adventure, // Stage 1 validated {manifest, gameData, scenarioData?}
  resolveAsset: path => localImageResources[path]
});
if (!result.ok) console.error(result.code, result.message);
const map = result.renderer;
map?.zoom(2);        // absolute zoom, clamped to 1–4
map?.pan(30, -20);   // viewport pixels, constrained to image bounds
map?.reset();       // fitted image, centered, zoom 1
map?.resize();      // automatic ResizeObserver also handles layout changes
map?.getView();     // copied {scale, x, y, loaded}
map?.destroy();     // remove DOM, listeners and resize observer
```

`readMap(adventure)` returns `{ok:true,map}` with a copied configuration or an
`{ok:false,code,message}` failure. It checks map structure defensively, including
physical QR references, but does not replace Stage 1 package validation.
Non-linear adventures return `map:null`; creation returns
`{ok:true,renderer:null,reason:'OBJECTIVES'}` without requiring a DOM or assets.

The established `manifest.map` format remains unchanged: `mode` is `static` or
`markers`, and `image` is a safe relative PNG/JPEG/WebP package path. Static maps
have no markers. Marker maps require an array with unique `id`, physical two-digit
`qr`, and finite percentage `x`/`y` in [0,100]. `label` is now optional (fallback:
`QR 02`); when supplied it must be a nonempty string. `description` is an optional
string. All previously valid packages remain valid. The Stage 1 schema already
provided all other checks; no validator logic changes were needed.

## Assets and future loader contract

The trusted caller supplies a synchronous `resolveAsset(packagePath)` function.
It must map a previously validated package path to an already available resource:
a blob URL, raster base64 data URL, file URL, or safe relative raster path.
HTTP(S), protocol-relative URLs, scripts, SVG and package traversal are refused.
The renderer does not concatenate a package path with a remote base URL or fetch
packages. The future loader owns MIME/signature validation, resource preparation,
and blob URL revocation after renderer destruction. Prepare asynchronous storage
reads before creating the renderer. Do not revoke a URL while the image is in use.
Missing resources, resolver exceptions, and image decoding failures display a
status message, disable markers/zoom and hide the image plane.

Markers use native keyboard-accessible buttons. Clicking shows literal text in a
small panel; closing returns focus to the marker. The focusable viewport accepts
arrow keys to pan, +/- to zoom and Home to reset. Mouse dragging, wheel zoom and
two-pointer pinch zoom are supported. `touch-action:none` and contained overflow
prevent page scrolling over the gesture surface. Image and markers share a
proportionally fitted, transformed plane so resize/zoom/pan keep them aligned.

Physical QR locations never become fixed NPC assignments. No marker scans a QR,
opens an encounter, completes a checkpoint or records a visit. Scenario-specific
NPC information must come from future trusted application integration with Stage
3; avoid scanning just to populate a map because scans revoke permissions and may
select a scenario. Circular maps need neither routes nor expected checkpoints.
Future live Map/Objective button integration, downloaded storage and adventure
switching are outside Stage 6. The renderer does not accept or modify saves.

## Open the interactive tester in VS Code

1. Open this repository folder in VS Code.
2. In Explorer, right-click `adventure-system/map-tester.html` and choose
   **Reveal in File Explorer**.
3. Double-click `map-tester.html` in File Explorer to open it in Chrome or Edge.
   The address starts with `file:///`; no server, Node installation or extension
   is required. Alternatively, use VS Code's Live Server extension if installed.
4. Choose **Circular static map** or **Linear marker map**. Zoom in before dragging
   to pan; at fitted zoom there is no extra image area to pan into. Click markers
   for information and use **Reset view**. On a phone, serve the repository on your
   local network and open the same page; physical phone gestures require manual
   testing.

The tester uses the actual renderer and both existing sample PNGs. Its minimal
trusted fixtures mirror Stage 1 and add a second physical marker to demonstrate
multiple markers. It loads no app scripts, save manager or service worker.
The sample images are small illustrations and may look pixelated when enlarged.

## Automated verification

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
& "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tests/test-map-renderer.js --browser | Out-Host
```

With Node on PATH, use `node tests/test-map-renderer.js --browser`.
Omit `--browser` for configuration tests only. Browser mode runs actual headless
Chrome against `tests/map-renderer-browser.html`, using a temporary profile removed
afterward. Set `QRCQ_TEST_BROWSER` to an alternative Chromium executable such as
Edge. No npm dependency or download is required. The harness checks real DOM/image
layout, dispatched click/key/wheel handlers, resize, missing/invalid assets, text
safety and the actual tester page. It does not simulate physical touch hardware or
certify Safari. Browser results must only be reported after running browser mode.

Run the Stage 1–5 suites and mod installer/runtime/localization regressions too.
The Spanish preview ZIP mismatch is a documented pre-existing localization failure.

Verified on 2026-11-17: 26 configuration checks and 22 headless Chrome checks
passed, with zero failures. The Node runner reports 27 passes because it counts
the browser harness as one additional test. Stage 1–5 regressions passed
96/85/64/89/50 checks respectively, all with zero failures. Mod runtime passed
10 and installer passed 14. Localization passed 12 before its existing Spanish
preview ZIP comparison failed (`core:es.encounters: keys differ;
core:es.items: keys differ`). Physical phone/Safari testing remains manual.
