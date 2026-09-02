QR CITY QUEST — RUNNABLE DEMO ZIP
=================================

WHAT IS INCLUDED
- index.html: open this to start the app.
- app.js + styles.css: the complete static app UI/engine.
- data/game-data.json: normalized runtime data compiled from the 120-row Gergo-app workbook.
- data/source-snapshot.csv: the workbook content used to generate the runtime data.
- manifest.webmanifest + sw.js: PWA/offline support when served from localhost or HTTPS.
- icons/: local PWA icons.

QUICK TEST (NO SERVER)
1. Unzip the folder.
2. Double-click index.html.
3. Use SCAN QR, then type a two-digit encounter ID such as 01, 04, or 10.

The game itself and local save work from the HTML file. Browsers normally block camera access and service workers on file:// pages, so the manual two-digit box is included for direct-file testing.

CAMERA + PWA/OFFLINE MODE
Camera and service-worker features require a secure context.

Option A — localhost on a computer:
- Windows: double-click start_server.bat (Python must be installed).
- macOS/Linux: run ./start_server.sh (Python 3 must be installed).
- Open http://localhost:8000 in your browser.

Option B — phone/friend deployment:
Upload the unzipped folder to any static HTTPS host. No backend is required.

QR SCANNING
This self-contained ZIP uses the browser's built-in BarcodeDetector when available. If the browser does not expose native QR detection, the two-digit entry box still lets you run every encounter. For the widest device compatibility, the production deployment should bundle ZXing as specified in the design document.

DEBUG MODE
Add ?debug=1 to the URL, for example:
  http://localhost:8000/?debug=1

Debug mode adds:
- simulate encounters 01–10
- jump to any PageID
- inventory editor
- expire timers immediately
- reset/save-state view

IMPLEMENTED GAME RULES
- QR IDs stay two-digit strings; PageIDs stay four-digit strings.
- Unknown/malformed/unregistered QR -> Unknown QR.
- One encounter engine for all bundled encounters.
- NEXT_SCAN affects Button 1 only and stores the future scan page.
- ADD_ITEM / REMOVE_ITEM use unique-item inventory semantics.
- HAS_ITEM hides Button 1 only.
- DROPDOWN_INVENTORY shows owned items; Other is routing fallback only.
- DROPDOWN_CHOICE maps explicit choices to pages.
- PASSWORD_INPUT from page 1006 is normalized to DROPDOWN_CHOICE.
- START_QUEST / COMPLETE_QUEST maintain active/completed state.
- START_TIMER stores an absolute end timestamp and uses -1 waiting state.
- OPEN_CASTLE stores castleOpen=true.
- TITLE_SCREEN routes to the dedicated YOU WON screen.
- Save data is stored locally in localStorage after every mutation.

SOURCE-DATA NOTE
The workbook page 0404 has START_TIMER and Button1/Next1 = 0408. This build follows the specification rule that a timer's resume page is the selected Next destination, so the timer resumes at 0408 exactly as authored. Page 0408 itself NEXT_SCAN-loops to 0408. If the intended wake-up page is 0409, change the source row's destination/authoring rule and regenerate the data.

UPDATING THE GAME DATA
If you export a newer authoring sheet to CSV with the same columns, replace:
  data/source-snapshot.csv
then run:
  python tools/compile_game_data.py

The compiler validates PageIDs, destinations, actions, dropdowns, timer durations, conditions, and required action data before replacing the runtime files.

BUILD VALIDATION
Run:
  python tests/validate_build.py
