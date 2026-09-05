(() => {
  "use strict";

  const GAME = window.QR_CITY_QUEST_DATA;
  const SAVE_KEY = "qr-city-quest-save-v1";
  const DEBUG = new URLSearchParams(location.search).get("debug") === "1";
  const app = document.getElementById("app");

  let save = loadSave();
  let currentEncounter = null;
  let currentItemName = null;
  let currentPageId = null;
  let transitionLocked = false;
  let scannerLocked = false;
  let cameraStream = null;
  let scanLoopToken = 0;
  let zxingControls = null;
  let offlineStatus = location.protocol === "file:" ? "Local files ready" : "Preparing offline mode…";

  if (!GAME || !GAME.encounters) {
    app.textContent = "Game data could not be loaded.";
    return;
  }
  
  function defaultSave() {
    return {
      schemaVersion: 1,
      inventory: [],
      quests: {},
      encounters: {},
      timers: {},
      flags: {
        castleOpen: false,
        unlockedAreas: []
      },
      itemState: {
        counters: {},
        usedButtons: {},
        oneTimeRewards: {}
      },
      lastSavedAt: Date.now()
    };
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      const value = JSON.parse(raw);
      if (!value || value.schemaVersion !== 1) return defaultSave();

      const clean = defaultSave();
      clean.inventory = Array.isArray(value.inventory)
        ? [...new Set(value.inventory.filter(x => typeof x === "string" && x.trim()).map(x => x.trim()))]
        : [];
      clean.quests = value.quests && typeof value.quests === "object" ? value.quests : {};
      clean.encounters = value.encounters && typeof value.encounters === "object" ? value.encounters : {};
      clean.timers = value.timers && typeof value.timers === "object" ? value.timers : {};
      clean.flags.castleOpen = !!(value.flags && value.flags.castleOpen);
      clean.flags.unlockedAreas = Array.isArray(value.flags && value.flags.unlockedAreas)
        ? [...new Set(value.flags.unlockedAreas.filter(x => typeof x === "string" && x.trim()))]
        : [];

      const oldItemState = value.itemState && typeof value.itemState === "object" ? value.itemState : {};
      clean.itemState.counters = oldItemState.counters && typeof oldItemState.counters === "object"
        ? oldItemState.counters
        : {};
      clean.itemState.usedButtons = oldItemState.usedButtons && typeof oldItemState.usedButtons === "object"
        ? oldItemState.usedButtons
        : {};
      clean.itemState.oneTimeRewards = oldItemState.oneTimeRewards && typeof oldItemState.oneTimeRewards === "object"
        ? oldItemState.oneTimeRewards
        : {};

      clean.lastSavedAt = Number(value.lastSavedAt) || Date.now();
      return clean;
    } catch (_) {
      return defaultSave();
    }
  }
  function showAreaLocked() {
    stopCamera();
  
    shell(`
      <section class="card error-card screen-card">
        <div class="error-icon" aria-hidden="true">🔒</div>
  
        <h2>Area Locked</h2>
  
        <p>
          You can't reach this place yet.
          The bridge is locked.
        </p>

  
        <div class="error-actions">
          <button
            class="primary"
            id="lockedHome"
            type="button"
          >
            OK
          </button>
        </div>
      </section>
    `, { back: showHome });
  
    document.getElementById("lockedHome").onclick =
      showHome;
  }
  function persist() {
    save.inventory = [...new Set(save.inventory)];
    save.flags.unlockedAreas = [...new Set(save.flags.unlockedAreas || [])];
    save.lastSavedAt = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      return true;
    } catch (_) {
      toast("Save could not be written on this browser.");
      return false;
    }
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(message) {
    const old = document.querySelector(".toast");
    if (old) old.remove();
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

function shell(content, { back = null, label = "CITY QUEST", debugButton = false } = {}) {
  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div>
          ${
            back
              ? `<button class="back-button" id="backBtn" type="button">← Back</button>`
              : `<div class="brand-mini">${esc(label)}</div>`
          }
        </div>

        <div class="top-actions">
          ${
            debugButton
              ? `<button class="icon-button" id="debugBtn" type="button">Debug</button>`
              : ""
          }
        </div>
      </header>

      ${content}
    </main>`;

  if (back) {
    document.getElementById("backBtn").onclick = back;
  }

  if (debugButton) {
    document.getElementById("debugBtn").onclick = showDebug;
  }
}
  
function stopCamera() {
  scanLoopToken++;
  scannerLocked = true;

  if (zxingControls) {
    try {
      zxingControls.stop();
    } catch (_) {}

    zxingControls = null;
  }

  if (cameraStream) {
    cameraStream
      .getTracks()
      .forEach(track => track.stop());

    cameraStream = null;
  }

  const video =
    document.getElementById("cameraVideo");

  if (video) {
    if (
      video.srcObject &&
      video.srcObject.getTracks
    ) {
      video.srcObject
        .getTracks()
        .forEach(track => track.stop());
    }

    video.srcObject = null;
  }
}

  function showHome() {
    stopCamera();
    currentEncounter = null;
    currentItemName = null;
    currentPageId = null;
    transitionLocked = false;

    shell(`
      <section class="hero"><h1>City Quest</h1></section>
      <section class="card home-grid">
        <div class="home-icon-grid">
          <div class="home-icon-cell"><button class="home-icon-button" id="scanBtn" type="button" aria-label="Scan QR">▣</button></div>
          <div class="home-icon-cell"><button class="home-icon-button" id="objectivesBtn" type="button" aria-label="Objectives">🎯</button></div>
          <div class="home-icon-cell"><button class="home-icon-button" id="inventoryBtn" type="button" aria-label="Inventory">📜</button></div>
          <div class="home-icon-cell"><button class="home-icon-button" id="extraBtn" type="button" aria-label="Other">🧲</button></div>
        </div>
      </section>`, { debugButton: DEBUG });

    document.getElementById("scanBtn").onclick = showScanner;
    document.getElementById("objectivesBtn").onclick = showObjectives;
    document.getElementById("inventoryBtn").onclick = showInventory;
    document.getElementById("extraBtn").onclick = () => toast("Not implemented yet.");
  }

  function getItemDefinition(itemName) {
    if (!GAME.items || typeof GAME.items !== "object") return null;
    if (GAME.items[itemName]) return { name: itemName, data: GAME.items[itemName] };

    for (const [name, item] of Object.entries(GAME.items)) {
      if (Array.isArray(item.aliases) && item.aliases.includes(itemName)) return { name, data: item };
    }
    return null;
  }

  function getItemDefinitionByQr(qr) {
    if (!GAME.items || typeof GAME.items !== "object") return null;

    for (const [name, item] of Object.entries(GAME.items)) {
      const startPage = String(item && item.startPage || "");
      if (startPage.slice(0, 2) === qr) return { name, data: item };
    }

    return null;
  }

  function showInventory() {
    stopCamera();
    currentEncounter = null;
    currentItemName = null;
    currentPageId = null;

    const items = save.inventory.length
      ? `<div class="list">${save.inventory.map((item, index) => `
          <button
            class="list-item"
            type="button"
            data-inventory-index="${index}"
            style="width:100%;text-align:left;color:inherit;font:inherit;cursor:pointer"
          >${esc(item)}</button>`).join("")}</div>`
      : `<div class="empty">You have no items yet.</div>`;

    shell(`
      <section class="card screen-card inventory-screen">
        ${items}
      </section>`, { back: showHome });

    document.querySelectorAll("[data-inventory-index]").forEach(button => {
      button.onclick = () => {
        const itemName = save.inventory[Number(button.dataset.inventoryIndex)];
        openItemDialogue(itemName);
      };
    });
  }

  function openItemDialogue(itemName) {
    const item = getItemDefinition(itemName);
    if (!item) return toast("This item has no dialogue yet.");
    currentItemName = item.name;
    currentEncounter = null;
    showPage(item.data.startPage);
  }

  function showObjectives() {
    stopCamera();
    const active = Object.entries(save.quests).filter(([, status]) => status === "active").map(([name]) => name);
    const body = active.length
      ? `<div class="list">${active.map(q => `<div class="list-item">◇ ${esc(q)}</div>`).join("")}</div>`
      : `<div class="empty">No active objectives.</div>`;
    shell(`
      <section class="card screen-card">
        <h1 class="screen-title">Objectives</h1>
        <p class="screen-subtitle">Only active quests appear here.</p>
        ${body}
      </section>`, { back: showHome });
  }

  function showScanner() {
    stopCamera();
    scannerLocked = false;
    const secure = window.isSecureContext || location.hostname === "localhost" || location.hostname === "127.0.0.1";
    shell(`
      <section class="card scanner-card">
        <div class="camera-wrap">
          <video id="cameraVideo" autoplay playsinline muted aria-label="QR camera preview"></video>
          <div class="scan-frame" aria-hidden="true"></div>
          <div class="camera-message" id="cameraMessage">${secure ? "Starting camera…" : "Camera needs HTTPS or localhost. You can still enter the two-digit code below."}</div>
        </div>
          <label class="secondary file-label">Scan QR from an image<input id="imageInput" type="file" accept="image/*"></label>
          <div class="notice" id="scannerNotice">QR values must be exactly two digits and exist in the bundled game data.</div>
        </div>
      </section>`, { back: showHome });

    document.getElementById("manualOpen").onclick = () => acceptScannedText(document.getElementById("manualCode").value);
    document.getElementById("manualCode").addEventListener("keydown", e => {
      if (e.key === "Enter") acceptScannedText(e.currentTarget.value);
    });
    document.getElementById("imageInput").addEventListener("change", scanImageFile);
    if (secure) startCameraScanner();
  }

async function startCameraScanner() {
  const msg = document.getElementById("cameraMessage");
  const video = document.getElementById("cameraVideo");

  if (!video || !msg) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    msg.textContent =
      "Camera access is not available here. Use the code box below.";
    return;
  }

  if (!window.ZXingBrowser) {
    msg.textContent = "QR scanner could not load.";
    return;
  }

  try {
    const codeReader =
      new ZXingBrowser.BrowserQRCodeReader();

    scannerLocked = false;

    zxingControls =
      await codeReader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: {
              ideal: "environment"
            }
          }
        },

        video,

        (result, error, controls) => {
          if (!result || scannerLocked) return;

          zxingControls = controls;

          const text = result.getText();

          console.log("QR scanned:", text);

          acceptScannedText(text);
        }
      );

    if (video.srcObject instanceof MediaStream) {
      cameraStream = video.srcObject;
    }

    msg.textContent =
      "Point the camera at a City Quest QR code.";

  } catch (err) {
    console.error("QR camera error:", err);

    msg.textContent =
      err && err.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access or enter the code below."
        : "Camera could not start. Use the two-digit code box below.";
  }
}

  async function scanImageFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const notice = document.getElementById("scannerNotice");
    const qrDetector = await getDetector();
    if (!qrDetector || !window.createImageBitmap) {
      notice.textContent = "This browser cannot decode QR images here. Enter the two-digit code manually.";
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const found = await qrDetector.detect(bitmap);
      if (bitmap.close) bitmap.close();
      if (found && found[0] && found[0].rawValue) acceptScannedText(found[0].rawValue);
      else notice.textContent = "No QR code was found in that image.";
    } catch (_) {
      notice.textContent = "That image could not be scanned.";
    }
  }

function acceptScannedText(raw) {
  if (scannerLocked) return;

  const qr = String(raw ?? "").trim();
  const encounterExists =
    /^\d{2}$/.test(qr) &&
    GAME.encounters &&
    GAME.encounters[qr];

  const item =
    /^\d{2}$/.test(qr)
      ? getItemDefinitionByQr(qr)
      : null;

  if (!encounterExists && !item) {
    scannerLocked = true;
    stopCamera();
    showUnknownQR();
    return;
  }

  scannerLocked = true;
  stopCamera();

  if (encounterExists) {
    resolveScan(qr);
    return;
  }

  if (item) {
    if (!save.inventory.includes(item.name)) {
      save.inventory.push(item.name);
      persist();
      toast(`${item.name} added to inventory.`);
    }

    openItemDialogue(item.name);
  }
}

  function resolveScan(encounterId) {
    const encounter = GAME.encounters[encounterId];
  
    if (!encounter) {
      return showUnknownQR();
    }
  
    // 🔒 AREA LOCK CHECK
    if (
      encounter.requiredArea &&
      !save.flags.unlockedAreas.includes(
        encounter.requiredArea
      )
    ) {
      return showAreaLocked();
    }
  
    currentEncounter = encounterId;
    currentItemName = null;
  
    const savedPage =
      save.encounters[encounterId] ||
      encounter.startPage;
  
    if (savedPage !== "-1") {
      return showPage(savedPage);
    }
  
    const timer = save.timers[encounterId];
  
    if (!timer) {
      return showDataError(
        `Encounter ${encounterId} is waiting (-1), but it has no timer record.`
      );
    }
  
    if (Date.now() < Number(timer.endAt)) {
      return showTimerWait(
        encounterId,
        timer
      );
    }
  
    if (!findPage(timer.resumePage)) {
      return showDataError(
        `Timer for encounter ${encounterId} points to missing page ${timer.resumePage}.`
      );
    }
  
    save.encounters[encounterId] =
      timer.resumePage;
  
    delete save.timers[encounterId];
  
    persist();
  
    showPage(timer.resumePage);
  }
  function findPageContext(pageId) {
    const id = String(pageId ?? "");

    const encounterId = id.slice(0, 2);
    const encounter = GAME.encounters && GAME.encounters[encounterId];
    if (encounter && encounter.pages && encounter.pages[id]) {
      return {
        type: "encounter",
        encounterId,
        itemName: null,
        page: encounter.pages[id]
      };
    }

    if (GAME.items) {
      for (const [itemName, item] of Object.entries(GAME.items)) {
        if (item && item.pages && item.pages[id]) {
          return {
            type: "item",
            encounterId: null,
            itemName,
            page: item.pages[id]
          };
        }
      }
    }

    return null;
  }

  function findPage(pageId) {
    const context = findPageContext(pageId);
    return context ? context.page : null;
  }

  function showTimerWait(encounterId, timer) {
    currentEncounter = encounterId;
    currentItemName = null;
    currentPageId = "-1";
    const mins = Math.max(1, Math.ceil((Number(timer.endAt) - Date.now()) / 60000));
    shell(`
      <section class="card screen-card encounter-card">
        <div class="speaker-row"><div class="speaker">Waiting</div>${DEBUG ? `<div class="page-id">TIMER · ${mins}m</div>` : ""}</div>
        <p class="dialogue">You can do nothing here.</p>
        <div class="choices"><button class="choice-btn" id="timerBye" type="button">Bye</button></div>
      </section>`, { back: showHome });
    document.getElementById("timerBye").onclick = showHome;
  }

  function showPage(pageId) {
    stopCamera();
    const context = findPageContext(pageId);
    if (!context) return showDataError(`Page ${pageId} does not exist.`);

    const page = context.page;
    currentEncounter = context.encounterId;
    currentItemName = context.itemName;
    currentPageId = page.id;
    transitionLocked = false;

    const dropdown = page.actions.find(a => a.type === "DROPDOWN_INVENTORY" || a.type === "DROPDOWN_CHOICE");
    let controls = "";

    if (dropdown) {
      const data = dropdownUI(dropdown);
      controls = `
        <div class="dropdown-wrap">
          ${data.empty
            ? `<div class="empty">You have no items.</div>`
            : `<select id="dropdownSelect" aria-label="Choose an option"><option value="">Choose…</option>${data.options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")}</select>`}
          <button class="primary" id="dropdownConfirm" type="button">Confirm</button>
        </div>`;
    } else {
      const buttons = visibleButtons(page, context);
      controls = buttons.length
        ? `<div class="choices">${buttons.map(b => `<button class="choice-btn" type="button" data-button-index="${b.index}" data-next="${esc(b.next || "")}">${DEBUG ? `<span class="num">${b.index}</span>` : ""}${esc(b.label)}</button>`).join("")}</div>`
        : `<div class="empty">No choices are available on this page.</div>`;
    }

    shell(`
      <section class="card screen-card encounter-card">
        <div class="speaker-row"><div class="speaker">${esc(page.speaker || "Encounter")}</div>${DEBUG ? `<div class="page-id">${esc(page.id)}</div>` : ""}</div>
        <p class="dialogue">${esc(page.text)}</p>
        ${controls}
      </section>`, { back: context.type === "item" ? showInventory : showHome });

    if (dropdown) {
      const confirm = document.getElementById("dropdownConfirm");
      if (confirm) confirm.onclick = () => confirmDropdown(page, dropdown);
    } else {
      document.querySelectorAll("[data-button-index]").forEach(button => {
        button.onclick = () => handleTransition(page, Number(button.dataset.buttonIndex), button.dataset.next);
      });
    }
  }

  function visibleButtons(page, context) {
    return page.buttons.filter(button => {
      if (button.index === 1 && page.condition) {
        if (page.condition.type === "HAS_ITEM" && !save.inventory.includes(page.condition.data)) return false;
      }

      if (context.type === "item") {
        const item = GAME.items && GAME.items[context.itemName];
        const mechanic = item && item.specialMechanics && item.specialMechanics.hideButtonAfterUse;
        if (mechanic && mechanic.page === page.id && mechanic.buttonLabel === button.label) {
          const key = usedButtonKey(context.itemName, mechanic.page, mechanic.buttonLabel);
          if (save.itemState.usedButtons[key]) return false;
        }
      }

      return true;
    });
  }

function dropdownUI(action) {
  if (action.type === "DROPDOWN_CHOICE") {
    return {
      empty: !action.options.length,
      options: action.options.map(o => ({
        label: o.label,
        value: o.label
      }))
    };
  }

  const options = save.inventory.map(item => ({
    label: item,
    value: item
  }));

  return {
    empty: options.length === 0,
    options
  };
}
  function confirmDropdown(page, action) {
    const select = document.getElementById("dropdownSelect");
    let destination = null;

    if (action.type === "DROPDOWN_INVENTORY" && (!select || !select.value)) {
      const other = action.options.find(o => o.label === "Other");
      if (!other) return toast("You have no items.");
      destination = other.next;
    } else {
      if (!select || !select.value) return toast("Choose an option first.");

      if (action.type === "DROPDOWN_CHOICE") {
        const match = action.options.find(o => o.label === select.value);
        destination = match && match.next;
      } else {
        const specific = action.options.find(o => o.label === select.value);
        const other = action.options.find(o => o.label === "Other");
        destination = (specific || other || {}).next;
      }
    }

    if (!destination) return showDataError(`No dropdown destination exists on ${page.id}.`);
    handleTransition(page, 1, destination);
  }

  function usedButtonKey(itemName, pageId, label) {
    return `${itemName}::${pageId}::${label}`;
  }

  function counterKey(itemName, name) {
    return `${itemName}::${name}`;
  }

  function rewardKey(itemName, rewardItem) {
    return `${itemName}::${rewardItem}`;
  }

  function applySpecialMechanicsBeforeTransition(context, page, buttonIndex, destination) {
    if (!context || context.type !== "item") return { destination, mutated: false };

    const itemName = context.itemName;
    const item = GAME.items && GAME.items[itemName];
    const mechanics = item && item.specialMechanics;
    if (!mechanics) return { destination, mutated: false };

    const button = page.buttons.find(b => b.index === buttonIndex);
    if (!button) return { destination, mutated: false };

    let mutated = false;

    if (mechanics.eatAttempts &&
        mechanics.eatAttempts.buttonPage === page.id &&
        mechanics.eatAttempts.buttonLabel === button.label) {
      const key = counterKey(itemName, "eatAttempts");
      const nextCount = Number(save.itemState.counters[key] || 0) + 1;
      save.itemState.counters[key] = nextCount;
      mutated = true;
      if (nextCount >= Number(mechanics.eatAttempts.attemptsBeforeConsumed || 5)) {
        destination = mechanics.eatAttempts.consumedPage;
      } else {
        destination = mechanics.eatAttempts.warningPage;
      }
    }

    if (mechanics.hideButtonAfterUse &&
        mechanics.hideButtonAfterUse.page === page.id &&
        mechanics.hideButtonAfterUse.buttonLabel === button.label) {
      const key = usedButtonKey(itemName, page.id, button.label);
      if (!save.itemState.usedButtons[key]) {
        save.itemState.usedButtons[key] = true;
        mutated = true;
      }
    }

    if (Array.isArray(mechanics.oneTimeCatches)) {
      const catchRule = mechanics.oneTimeCatches.find(rule =>
        rule.fromPage === page.id && rule.button === button.label
      );
      if (catchRule) {
        const key = rewardKey(itemName, catchRule.rewardItem);
        if (save.itemState.oneTimeRewards[key]) destination = catchRule.repeatPage;
        else destination = catchRule.rewardPage;
      }
    }

    return { destination, mutated };
  }

  function applySpecialMechanicsAfterActions(context, page) {
    if (!context || context.type !== "item") return false;
    const item = GAME.items && GAME.items[context.itemName];
    const mechanics = item && item.specialMechanics;
    if (!mechanics || !Array.isArray(mechanics.oneTimeCatches)) return false;

    let mutated = false;
    for (const rule of mechanics.oneTimeCatches) {
      if (rule.rewardPage !== page.id) continue;
      const key = rewardKey(context.itemName, rule.rewardItem);
      if (!save.itemState.oneTimeRewards[key]) {
        save.itemState.oneTimeRewards[key] = true;
        mutated = true;
      }
    }
    return mutated;
  }

  function resetItemOnFreshAdd(itemName) {
    if (itemName !== "Sweets") return false;
    const key = counterKey("Sweets", "eatAttempts");
    if (Number(save.itemState.counters[key] || 0) === 0) return false;
    save.itemState.counters[key] = 0;
    return true;
  }

  function handleTransition(page, buttonIndex, destination) {
    if (transitionLocked) return;
    transitionLocked = true;
    if (!destination) return showDataError(`Button ${buttonIndex} on page ${page.id} has no destination.`);

    const context = findPageContext(page.id);
    const special = applySpecialMechanicsBeforeTransition(context, page, buttonIndex, destination);
    destination = special.destination;

    let mutated = special.mutated;
    let timerStarted = false;
    let nextScan = false;

    for (const action of page.actions) {
      switch (action.type) {

        case "ADD_ITEM": {
          if (action.data && !save.inventory.includes(action.data)) {
            save.inventory.push(action.data);
            resetItemOnFreshAdd(action.data);
            mutated = true;
          }
          break;
        }

        case "REMOVE_ITEM": {
          const before = save.inventory.length;
          save.inventory = save.inventory.filter(item => item !== action.data);
          if (save.inventory.length !== before) mutated = true;
          break;
        }

        case "START_QUEST":
          if (save.quests[action.data] !== "completed" && save.quests[action.data] !== "active") {
            save.quests[action.data] = "active";
            mutated = true;
          }
          break;

        case "COMPLETE_QUEST":
          if (save.quests[action.data] !== "completed") {
            save.quests[action.data] = "completed";
            mutated = true;
          }
          break;

        case "START_TIMER":
          if (!context || context.type !== "encounter") {
            return showDataError(`Timer on ${page.id} can only be used by a QR encounter.`);
          }
          if (!/^\d{4}$/.test(destination) || !findPage(destination)) {
            return showDataError(`Timer on ${page.id} needs a real resume PageID.`);
          }
          save.encounters[context.encounterId] = "-1";
          save.timers[context.encounterId] = {
            endAt: Date.now() + Number(action.durationMs),
            resumePage: destination
          };
          mutated = true;
          timerStarted = true;
          break;

        case "OPEN_CASTLE":
          if (!save.flags.castleOpen) {
            save.flags.castleOpen = true;
            mutated = true;
          }
          break;

        case "UNLOCK_AREA":
          if (action.data && !save.flags.unlockedAreas.includes(action.data)) {
            save.flags.unlockedAreas.push(action.data);
            mutated = true;
          }
          break;

        case "DROPDOWN_INVENTORY":
        case "DROPDOWN_CHOICE":
          break;

        default:
          return showDataError(`Unknown action ${action.type} on ${page.id}.`);

        case "NEXT_SCAN":
          if (buttonIndex === 1) nextScan = true;
          break;
      }
    }

    if (applySpecialMechanicsAfterActions(context, page)) mutated = true;

    if (timerStarted) {
      persist();
      toast("Progress saved. Come back after the timer.");
      return showHome();
    }

    if (nextScan) {
      if (!context || context.type !== "encounter") {
        return showDataError(`NEXT_SCAN on ${page.id} can only be used by a QR encounter.`);
      }
      if (!/^\d{4}$/.test(destination) || !findPage(destination)) {
        return showDataError(`NEXT_SCAN on ${page.id} points to invalid page ${destination}.`);
      }
      save.encounters[context.encounterId] = destination;
      persist();
      return showHome();
    }

    if (mutated) persist();
    resolveDestination(destination);
  }

  function resolveDestination(destination) {
    if (destination === "HOME") return showHome();
    if (destination === "TITLE_SCREEN") return showWin();
    if (destination === "-1") return showHome();
    if (!/^\d{4}$/.test(destination)) return showDataError(`Unknown destination ${destination}.`);
    if (!findPage(destination)) return showDataError(`Page ${destination} does not exist.`);
    showPage(destination);
  }

  function showWin() {
    stopCamera();
    shell(`
      <section class="win">
        <div class="win-inner">
          <div class="win-crown" aria-hidden="true">♛</div>
          <h1>YOU WON</h1>
          <p>The QR City Quest demo is complete.</p>
          ${DEBUG ? `<button class="secondary" id="winHome" type="button">Home</button>` : ""}
        </div>
      </section>`);
    if (DEBUG) document.getElementById("winHome").onclick = showHome;
  }

  function showDataError(detail) {
    stopCamera();
    console.error("QR City Quest data error:", detail);
    shell(`
      <section class="card error-card screen-card">
        <div class="error-icon" aria-hidden="true">!</div>
        <h2>Something went wrong</h2>
        <p>There is a problem with this encounter's game data.</p>
        ${DEBUG ? `<div class="notice">${esc(detail)}</div>` : ""}
        <div class="error-actions"><button class="primary" id="errorHome" type="button">Home</button></div>
      </section>`, { back: showHome });
    document.getElementById("errorHome").onclick = showHome;
  }

  function allItemNames() {
    const names = new Set(save.inventory);

    if (GAME.items) {
      Object.keys(GAME.items).forEach(name => names.add(name));
    }

    for (const enc of Object.values(GAME.encounters)) {
      for (const page of Object.values(enc.pages)) {
        for (const action of page.actions) {
          if ((action.type === "ADD_ITEM" || action.type === "REMOVE_ITEM") && action.data) names.add(action.data);
          if (action.type === "DROPDOWN_INVENTORY") {
            action.options.filter(o => o.label !== "Other").forEach(o => names.add(o.label));
          }
        }
      }
    }

    return [...names].sort((a, b) => a.localeCompare(b));
  }

  function showDebug() {
    stopCamera();
    const items = allItemNames();
    shell(`
      <section class="card screen-card">
        <h1 class="screen-title">Debug tools</h1>
        <p class="screen-subtitle">Development-only helpers from the build specification.</p>
        <div class="debug-grid">${Object.keys(GAME.encounters).map(id => `<button type="button" data-debug-scan="${id}">${id}</button>`).join("")}</div>
        <div class="debug-section">
          <h3>Jump to PageID</h3>
          <div class="debug-row"><input class="code-input" id="jumpPage" inputmode="numeric" maxlength="4" placeholder="2301"><button class="primary" id="jumpBtn" type="button">Jump</button></div>
        </div>
        <div class="debug-section">
          <h3>Inventory editor</h3>
          <div class="debug-row"><select id="debugItem">${items.map(i => `<option>${esc(i)}</option>`).join("")}</select><button class="primary" id="addItemBtn" type="button">Add</button></div>
          <button class="secondary" id="clearItemsBtn" type="button" style="width:100%;margin-top:8px">Clear inventory</button>
        </div>
        <div class="debug-section">
          <button class="secondary" id="expireTimers" type="button" style="width:100%">Expire all timers now</button>
          <button class="danger" id="resetSave" type="button" style="width:100%;margin-top:8px">Reset save</button>
        </div>
        <div class="debug-section"><h3>Current save</h3><pre class="state">${esc(JSON.stringify(save, null, 2))}</pre></div>
      </section>`, { back: showHome });

    document.querySelectorAll("[data-debug-scan]").forEach(button => {
      button.onclick = () => resolveScan(button.dataset.debugScan);
    });

    document.getElementById("jumpBtn").onclick = () => {
      const id = document.getElementById("jumpPage").value.trim();
      if (!findPage(id)) return toast("Page not found.");
      showPage(id);
    };

    document.getElementById("addItemBtn").onclick = () => {
      const item = document.getElementById("debugItem").value;
      if (!save.inventory.includes(item)) {
        save.inventory.push(item);
        resetItemOnFreshAdd(item);
      }
      persist();
      showDebug();
    };

    document.getElementById("clearItemsBtn").onclick = () => {
      save.inventory = [];
      persist();
      showDebug();
    };

    document.getElementById("expireTimers").onclick = () => {
      Object.values(save.timers).forEach(timer => timer.endAt = Date.now() - 1);
      persist();
      showDebug();
    };

    document.getElementById("resetSave").onclick = () => {
      if (!confirm("Reset all QR City Quest progress on this device?")) return;
      save = defaultSave();
      persist();
      showHome();
    };
  }

  async function registerOffline() {
    if (!("serviceWorker" in navigator) || !["http:", "https:"].includes(location.protocol)) return;
    try {
      await navigator.serviceWorker.register("./sw.js");
      await navigator.serviceWorker.ready;
      offlineStatus = "✓ Ready for offline play";
      if (document.querySelector(".status-line")) showHome();
    } catch (_) {
      offlineStatus = "Online mode";
    }
  }

  window.addEventListener("pagehide", stopCamera);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && cameraStream) {
      stopCamera();
    } else if (!document.hidden && document.getElementById("cameraVideo") && !cameraStream) {
      scannerLocked = false;
      startCameraScanner();
    }
  });

  showHome();
  registerOffline();
  })();
