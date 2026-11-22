(() => {
  "use strict";

  const GAME = window.QR_CITY_QUEST_DATA;
  const TEXT = window.QR_CITY_QUEST_APP_TEXT;

  const session = window.QRCQ_ACTIVE_SESSION;
  const play = window.QRCQ_ACTIVE_PLAY;
  let uiBusy = false;
  let disposeScreen = null;
  const DEBUG_VISIBLE_KEY = "qr-city-quest-debug-visible-v1";
  const LOCAL_DEV = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const DEBUG = LOCAL_DEV && new URLSearchParams(location.search).get("debug") === "1";
  const DEBUG_SECRET = "QRCITY";
  const dropdownTransition = Symbol("dropdown");
  const LANGUAGE = window.QR_CITY_QUEST_LANGUAGE || "en";
  const app = document.getElementById("app");

  // apptext_en.js must be loaded before app.js
  if (!TEXT) {
    console.error("QR City Quest app text could not be loaded.");
    return;
  }

  let save = session.saved();
  let currentEncounter = null;
  let currentItemName = null;
  let currentPageId = null;
  let transitionLocked = false;
  let scannerLocked = false;
  let cameraStream = null;
  let scanLoopToken = 0;
  let zxingControls = null;
  let debugSecretBuffer = "";
  let secretDebugVisible = loadSecretDebugVisibility();

  let offlineStatus =
    location.protocol === "file:"
      ? TEXT.localFilesReady
      : TEXT.preparingOfflineMode;

  if (!GAME || !GAME.encounters) {
    app.textContent = TEXT.gameDataCouldNotLoad;
    return;
  }


  // =========================================================
  // SAVE
  // =========================================================

  async function persist() {
    save.inventory = [...new Set(save.inventory)];
    save.hadItems = [...new Set([...save.hadItems, ...save.inventory])];
    save.knowledge = [...new Set(save.knowledge)];
    save.flags.unlockedAreas = [...new Set(save.flags.unlockedAreas)];
    save.lastSavedAt = Date.now();
    uiBusy = true;
    try {
      const result = await session.update(save);
      if (!result.ok) {
        save = session.saved();
        saveError(result.code);
        return false;
      }
      return true;
    } finally { uiBusy = false; }
  }

  function saveError(code) {
    showHome();
    toast(code === 'STALE_TRANSITION'
      ? d('The active save changed in another tab. Reload before continuing.', 'A mentés másik lapon megváltozott. A folytatáshoz töltsd újra az oldalt.')
      : TEXT.saveCouldNotBeWritten);
    if (code === 'STALE_TRANSITION') {
      const footer = document.querySelector(".home-settings-footer");
      if (footer) screenButton(footer, d("Reload saved progress", "Mentett haladás újratöltése"), () => location.reload());
    }
  }

  function loadSecretDebugVisibility() {
    try {
      return (
        localStorage.getItem(
          DEBUG_VISIBLE_KEY
        ) === "1"
      );
    } catch (_) {
      return false;
    }
  }


  function saveSecretDebugVisibility() {
    try {
      localStorage.setItem(
        DEBUG_VISIBLE_KEY,
        secretDebugVisible ? "1" : "0"
      );
    } catch (_) {}
  }


  function toggleSecretDebugVisibility() {
    secretDebugVisible =
      !secretDebugVisible;

    saveSecretDebugVisibility();

    showHome();

    toast(
      secretDebugVisible
        ? d(
            "Debug button enabled.",
            "Debug gomb bekapcsolva."
          )
        : d(
            "Debug button hidden.",
            "Debug gomb elrejtve."
          )
    );
  }


  // =========================================================
  // HELPERS
  // =========================================================

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  function toast(message) {
    const old =
      document.querySelector(".toast");

    if (old) {
      old.remove();
    }

    const el =
      document.createElement("div");

    el.className = "toast";
    el.textContent = message;

    document.body.appendChild(el);

    setTimeout(
      () => el.remove(),
      2200
    );
  }


  function shell(
    content,
    {
      back = null,
      label = TEXT.appName,
      home = false
    } = {}
  ) {
    disposeScreen?.();
    disposeScreen = null;
    app.innerHTML = `
      <main class="shell">

        <header class="topbar${home ? " home-topbar" : ""}">

          <div>
            ${
              back
                ? `
                  <button
                    class="back-button"
                    id="backBtn"
                    type="button"
                  >
                    ${esc(TEXT.back)}
                  </button>
                `
                : `
                  <div class="brand-mini">
                    ${esc(label)}
                  </div>
                `
            }
          </div>

        </header>

        ${content}

      </main>
    `;

    if (back) {
      document
        .getElementById("backBtn")
        .onclick = back;
    }

    // Settings now contains both language selection and debug tools.
  }


  // =========================================================
  // CAMERA
  // =========================================================

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
        .forEach(
          track => track.stop()
        );

      cameraStream = null;
    }

    const video =
      document.getElementById(
        "cameraVideo"
      );

    if (video) {
      if (
        video.srcObject &&
        video.srcObject.getTracks
      ) {
        video.srcObject
          .getTracks()
          .forEach(
            track => track.stop()
          );
      }

      video.srcObject = null;
    }
  }


  // =========================================================
  // HOME
  // =========================================================

  function showHome() {
    stopCamera();

    currentEncounter = null;
    currentItemName = null;
    currentPageId = null;
    transitionLocked = false;
    play?.close();
    const manifest = session.active.adventure.manifest;
    const usesMap = manifest.type !== "non-linear";

    shell(`
      <section class="hero">
        <h1 id="homeTitleSecret">${esc(play ? manifest.name : TEXT.homeTitle)}</h1>
      </section>

      <section class="card home-grid">

        <div class="home-icon-grid">

          <div class="home-icon-cell">
            <button
              class="home-icon-button"
              id="scanBtn"
              type="button"
              aria-label="${esc(TEXT.scanQR)}"
            >
              ▣
            </button>
          </div>

          <div class="home-icon-cell">
            <button
              class="home-icon-button"
              id="objectivesBtn"
              type="button"
              aria-label="${esc(usesMap ? d("Map", "Térkép") : TEXT.objectives)}"
            >
              🎯
            </button>
          </div>

          <div class="home-icon-cell">
            <button
              class="home-icon-button"
              id="inventoryBtn"
              type="button"
              aria-label="${esc(TEXT.inventory)}"
            >
              📜
            </button>
          </div>

          <div class="home-icon-cell">
            <button
              class="home-icon-button"
              id="knowledgeBtn"
              type="button"
              aria-label="${esc(
                d(
                  "Things I Know",
                  "Amit tudok"
                )
              )}"
            >
              📖
            </button>
          </div>
        </div>

      </section>

      <footer class="home-settings-footer">
        <button class="home-settings-button" id="adventuresBtn" type="button">${esc(d("Adventures", "Kalandok"))}</button>
        ${save.completed || play?.getCompletionStatus().completed
          ? `<button class="home-settings-button" id="victoryBtn" type="button">${esc(d("Victory", "Győzelem"))}</button>` : ""}
        <button class="home-settings-button" id="settingsBtn" type="button">
          ⚙ ${esc(TEXT.settings)}
        </button>
      </footer>
    `, { home: true });

    document
      .getElementById("scanBtn")
      .onclick = showScanner;

    document
      .getElementById("objectivesBtn")
      .onclick = usesMap ? showAdventureMap : showObjectives;

    document
      .getElementById("inventoryBtn")
      .onclick = showInventory;

    document
      .getElementById("knowledgeBtn")
      .onclick = showThingsIKnow;

    document
      .getElementById("settingsBtn")
      .onclick = showSettings;
    document.getElementById("adventuresBtn").onclick = showAdventures;
    const victoryButton = document.getElementById("victoryBtn");
    if (victoryButton) victoryButton.onclick = showAdventureVictory;

    const secretTitle =
      document.getElementById(
        "homeTitleSecret"
      );

    if (secretTitle) {
      let secretTapCount = 0;
      let secretTapTimer = null;

      secretTitle.addEventListener(
        "click",
        () => {
          secretTapCount += 1;

          if (secretTapTimer) {
            clearTimeout(
              secretTapTimer
            );
          }

          secretTapTimer =
            setTimeout(
              () => {
                secretTapCount = 0;
              },
              2500
            );

          if (
            secretTapCount < 5
          ) {
            return;
          }

          secretTapCount = 0;

          clearTimeout(
            secretTapTimer
          );

          const code =
            window.prompt(
              d(
                "Enter secret code:",
                "Írd be a titkos kódot:"
              )
            );

          if (
            String(code ?? "")
              .trim()
              .toUpperCase() ===
            DEBUG_SECRET
          ) {
            toggleSecretDebugVisibility();
          }
        }
      );
    }
  }

  function showAdventures() {
    stopCamera();
    play?.close();
    shell('<div class="adventure-actions" id="adventure-actions"></div><div id="adventure-browser"></div>');
    const controls = document.getElementById("adventure-actions");
    const reload = () => location.reload();
    const resume = () => { if (!browser.getState().committing) showHome(); };
    screenButton(controls, d("Resume adventure", "Kaland folytatása"), resume);
    if (play) screenButton(controls, d("Switch to QR City Quest", "Váltás a QR City Questre"), async () => {
      if (uiBusy || browser.getState().busy) return;
      const completed = play.getCompletionStatus().completed;
      if (!completed && !window.confirm(d("Switching discards the unfinished adventure. Continue?",
        "A váltás törli a befejezetlen kaland mentését. Folytatod?"))) return;
      uiBusy = true;
      try {
        const result = await session.storage.activateBuiltIn(play.getRevision(), { confirmed: !completed });
        if (result.ok) reload();
        else toast(d("The switch could not be saved.", "A váltás mentése sikertelen."));
      } catch (error) { saveError(error.code); }
      finally { uiBusy = false; }
    });
    const browser = QRCQAdventureBrowser.createAdventureBrowser({
      container: document.getElementById("adventure-browser"), storage: session.storage, locale: LANGUAGE,
      catalogURL: LOCAL_DEV ? QRCQAdventureCatalog.DEVELOPMENT_CATALOG_URL : QRCQAdventureCatalog.DEFAULT_CATALOG_URL,
      onActivated: reload,
      messages: {
        integration: d("Resume the active adventure from this screen.", "Innen folytathatod az aktív kalandot."),
        replaceTitle: d("Replace your current adventure?", "Lecseréled a jelenlegi kalandot?"),
        replaceText: d("Replacing this adventure discards its unfinished progress.",
          "A csere törli a jelenlegi kaland befejezetlen haladását."),
        completed: d("Adventure completed", "Kaland teljesítve"),
        unfinished: d("Unfinished progress saved", "Befejezetlen haladás mentve")
      }
    });
    disposeScreen = () => { void browser.destroy(); };
  }

  function screenButton(parent, label, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-btn";
    button.textContent = label;
    button.onclick = action;
    parent.append(button);
    return button;
  }

  function showAdventureMap() {
    const adventure = structuredClone(session.active.adventure);
    const route = adventure.scenarioData?.scenarios[play.getProgress().scenarioState?.scenarioId];
    if (route && adventure.manifest.map?.markers) {
      adventure.manifest.map.markers = adventure.manifest.map.markers.filter(marker => route.sequence.includes(marker.qr));
    }
    shell('<section class="card" id="adventure-map"></section>', { back: showHome });
    const container = document.getElementById("adventure-map");
    const mapped = QRCQMapRenderer.createMapRenderer({ container, adventure, resolveAsset: pictureUrl });
    if (mapped.renderer) {
      disposeScreen = () => mapped.renderer.destroy();
      if (route) {
        const progress = document.createElement("p");
        const { completedCheckpoints, scenarioId } = play.getProgress().scenarioState;
        progress.textContent = `${scenarioId} · ${completedCheckpoints.length}/${route.sequence.length}`;
        container.prepend(progress);
      }
    }
    else container.textContent = d("Map unavailable.", "A térkép nem érhető el.");
  }

  async function showAdventureVictory() {
    stopCamera();
    play?.close();
    shell('<div id="live-victory"></div>', { back: showHome });
    const container = document.getElementById("live-victory");
    const view = await QRCQAdventureVictory.mountVictory({ container, storage: session.storage, locale: LANGUAGE,
      expectedRevision: play ? play.getRevision() : session.revision(),
      onBack: showAdventures, onReplay: () => location.reload() });
    if (!container.isConnected) { view.destroy?.(); return; }
    if (view.ok) disposeScreen = view.destroy;
    else if (view.code === "STALE_TRANSITION") showSaveRecovery();
    else container.textContent = d("Saved victory is unavailable.", "A mentett győzelem nem érhető el.");
  }

  async function runAdventureInteraction(operation, commit = true) {
    if (uiBusy) return;
    uiBusy = true;
    try {
      const result = await operation();
      if (!result.ok) {
        if (result.code === "AREA_LOCKED") showAreaLocked();
        else if (result.code === "ITEM_ALREADY_COLLECTED") { showHome(); toast(TEXT.itemAlreadyCollected); }
        else if (result.code === "STALE_TRANSITION" || play.hasPendingWrite()) showSaveRecovery();
        else if (result.code === "OUT_OF_ORDER") {
          showUnknownQR();
          toast(d(`Scan QR ${result.expectedQR} first.`, `Először a(z) ${result.expectedQR} QR-kódot olvasd be.`));
        } else if (result.type || ["INVALID_QR", "UNKNOWN_QR", "INVALID_START", "START_NOT_ELIGIBLE",
          "COMPLETED_CHECKPOINT_REQUIRED"].includes(result.code)) showUnknownQR();
        else toast(d("This interaction is unavailable.", "Ez a művelet nem érhető el."));
        return;
      }
      if (!result.completed && commit && !result.readOnly) {
        const saved = await play.flush();
        if (!saved.ok) {
          showSaveRecovery();
          return;
        }
      }
      save = play.getProgress();
      if (result.completed) await showAdventureVictory();
      else if (result.page) showAdventureDialogue(result);
      else showHome();
    } catch (error) {
      console.error("Adventure interaction:", error);
      showSaveRecovery();
    } finally { uiBusy = false; }
  }

  function showSaveRecovery() {
    shell('<section class="card" id="play-recovery"></section>', { back: showHome });
    const recovery = document.getElementById("play-recovery");
    recovery.textContent = d("Progress could not be saved.", "A haladás mentése sikertelen.");
    screenButton(recovery, d("Reload saved progress", "Mentett haladás újratöltése"), () => location.reload());
  }

  function showAdventureDialogue(view) {
    shell('<section class="card encounter-card" id="active-dialogue"></section>', { back: showHome });
    const container = document.getElementById("active-dialogue");
    const addText = (tag, text, className) => {
      const node = document.createElement(tag);
      node.className = className;
      node.textContent = text;
      container.append(node);
    };
    const picture = pictureUrl(view.picture);
    if (picture) {
      const image = document.createElement("img");
      image.className = "adventure-dialogue-image";
      image.alt = "";
      image.src = picture;
      image.onerror = () => image.remove();
      container.append(image);
    }
    addText("h2", view.page.speaker, "speaker");
    addText("p", view.page.text, "dialogue");
    if (view.waitingUntil) addText("p", d("Scan again when the timer ends.", "Az idő lejártakor olvasd be újra a kódot.") +
      " " + new Date(view.waitingUntil).toLocaleTimeString(LANGUAGE), "dialogue");
    else if (view.readOnly) addText("p", d("Read only", "Csak olvasható"), "dialogue");
    for (const choice of play.choices(view)) {
      let select;
      if (choice.dropdown) {
        select = document.createElement("select");
        select.setAttribute("aria-label", choice.label);
        const inventory = choice.dropdown.type === "DROPDOWN_INVENTORY";
        const options = inventory ? save.inventory.map(id => [id, getItemDisplayName(id)]) :
          choice.dropdown.options.map(({ label }, index) => [index, label]);
        if (inventory) options.unshift(["", d("No item", "Nincs tárgy")]);
        for (const [value, label] of options) select.add(new Option(label, value));
        container.append(select);
      }
      screenButton(container, choice.label, () => runAdventureInteraction(() => play.choose(view, choice.index,
        choice.dropdown?.type === "DROPDOWN_CHOICE" ? Number(select.value) : select?.value), !view.readOnly));
    }
  }

  // =========================================================
  // AREA LOCKED
  // =========================================================

  function showAreaLocked() {
    stopCamera();

    shell(`
      <section class="card error-card screen-card">

        <div
          class="error-icon"
          aria-hidden="true"
        >
          🔒
        </div>

        <h2>
          ${esc(TEXT.areaLockedTitle)}
        </h2>

        <p>
          ${esc(TEXT.areaLockedText)}
        </p>

        <div class="error-actions">

          <button
            class="primary"
            id="lockedHome"
            type="button"
          >
            ${esc(TEXT.ok)}
          </button>

        </div>

      </section>
    `, {
      back: showHome
    });

    document
      .getElementById("lockedHome")
      .onclick = showHome;
  }


  // =========================================================
  // ITEMS
  // =========================================================

  function getItemDefinition(itemName) {
    if (
      !GAME.items ||
      typeof GAME.items !== "object"
    ) {
      return null;
    }

    if (GAME.items[itemName]) {
      return {
        name: itemName,
        data: GAME.items[itemName]
      };
    }

    for (
      const [name, item]
      of Object.entries(GAME.items)
    ) {
      if (
        Array.isArray(item.aliases) &&
        item.aliases.includes(itemName)
      ) {
        return {
          name,
          data: item
        };
      }
    }

    return null;
  }


  function getItemDisplayName(itemName) {
    const item =
      getItemDefinition(itemName);

    if (
      item &&
      item.data &&
      typeof item.data.displayName === "string" &&
      item.data.displayName.trim()
    ) {
      return item.data.displayName.trim();
    }

    return (
      item &&
      item.name
    ) || String(itemName ?? "");
  }


  // A mod QR includes the expansion namespace (for example london:02).
  function isValidGameQr(qr) {
    return /^(?:[0-9]{2}|[a-z][a-z0-9-]{1,47}:[0-9]{2})$/.test(qr);
  }

  function isDialoguePageId(id) {
    return /^(?:[0-9]{4}|[a-z][a-z0-9-]{1,47}:[0-9]{4})$/.test(String(id));
  }

  function pictureUrl(name) {
    if (play) return name ? window.QRCQ_ACTIVE_ASSETS?.resolveAsset(name) : undefined;
    if (!name) return null;
    if (name.includes(":")) {
      return (window.QRCQ_MOD_IMAGES || {})[name] || null;
    }
    return "./images/" + encodeURIComponent(name) + ".png?v=42";
  }

  function getItemDefinitionByQr(qr) {
    if (
      !GAME.items ||
      typeof GAME.items !== "object"
    ) {
      return null;
    }

    for (
      const [name, item]
      of Object.entries(GAME.items)
    ) {
      const startPage =
        String(
          item &&
          item.startPage ||
          ""
        );

      const colon = startPage.indexOf(":");
      const itemQr = (colon >= 0 ? startPage.slice(0, colon + 1) : "") +
        startPage.slice(colon + 1, colon + 3);

      if (itemQr === qr) {
        return {
          name,
          data: item
        };
      }
    }

    return null;
  }


  // =========================================================
  // INVENTORY
  // =========================================================

  function showInventory() {
  stopCamera();

  currentEncounter = null;
  currentItemName = null;
  currentPageId = null;

  // Disabled mod items remain saved but are hidden until the mod is enabled again.
  const visibleItems = save.inventory.filter(itemName =>
    !itemName.includes(":") || Object.prototype.hasOwnProperty.call(GAME.items || {}, itemName)
  );

  const items =
    visibleItems.length
      ? `
        <div class="inventory-grid">
          ${
            visibleItems
              .map((itemName, index) => {
                const item =
                  getItemDefinition(itemName);

                const displayName =
                  getItemDisplayName(itemName);

                const picture =
                  item &&
                  item.data &&
                  typeof item.data.defaultPicture === "string" &&
                  item.data.defaultPicture.trim()
                    ? item.data.defaultPicture.trim()
                    : "";

                const iconSrc = pictureUrl(picture);

                return `
                  <button
                    class="inventory-item-button"
                    type="button"
                    data-inventory-index="${index}"
                    aria-label="${esc(displayName)}"
                    title="${esc(displayName)}"
                  >
                    ${
                      iconSrc
                        ? `
                          <img
                            class="inventory-item-icon"
                            src="${esc(iconSrc)}"
                            alt=""
                            loading="lazy"
                            decoding="async"
                          >
                        `
                        : `
                          <span class="inventory-item-fallback">
                            ${esc(displayName)}
                          </span>
                        `
                    }
                  </button>
                `;
              })
              .join("")
          }
        </div>
      `
      : `
        <div class="empty">
          ${esc(TEXT.noItemsYet)}
        </div>
      `;

  shell(`
    <section class="card screen-card inventory-screen">
      ${items}
    </section>
  `, {
    back: showHome
  });

  document
    .querySelectorAll(
      "[data-inventory-index]"
    )
    .forEach(button => {
      const image =
        button.querySelector(
          ".inventory-item-icon"
        );

      if (image) {
        image.onerror = () => {
          image.remove();
          button.classList.add(
            "inventory-item-missing-image"
          );

          if (
            !button.querySelector(
              ".inventory-item-fallback"
            )
          ) {
            const fallback =
              document.createElement("span");

            fallback.className =
              "inventory-item-fallback";

            fallback.textContent =
              button.getAttribute(
                "aria-label"
              ) || "?";

            button.appendChild(fallback);
          }
        };
      }

      button.onclick = () => {
        const itemName =
          visibleItems[
            Number(
              button.dataset
                .inventoryIndex
            )
          ];

        openItemDialogue(
          itemName
        );
      };
    });
}

function openItemDialogue(itemName) {
    if (play) return runAdventureInteraction(() => play.openItem(itemName), false);
  const item =
    getItemDefinition(itemName);

  if (!item) {
    return toast(
      TEXT.itemHasNoDialogue
    );
  }

  currentItemName = item.name;
  currentEncounter = null;
  currentPageId = null;

  if (
    item.data &&
    item.data.implemented === false
  ) {
    shell(`
      <section class="card screen-card encounter-card">
        <div class="speaker-row">
          <div class="speaker">
            ${esc(getItemDisplayName(item.name))}
          </div>
        </div>

        <p class="dialogue">
          ${esc(TEXT.itemNotImplementedYet)}
        </p>

        <div class="choices">
          <button
            class="choice-btn"
            id="unimplementedItemOk"
            type="button"
          >
            ${esc(TEXT.ok)}
          </button>
        </div>
      </section>
    `, {
      back: showInventory
    });

    document
      .getElementById("unimplementedItemOk")
      .onclick = showInventory;

    return;
  }

  showPage(
    item.data.startPage
  );
}


function getQuestDisplayName(questName) {
  if (
    GAME.questDisplayNames &&
    typeof GAME.questDisplayNames[questName] === "string" &&
    GAME.questDisplayNames[questName].trim()
  ) {
    return GAME.questDisplayNames[questName].trim();
  }

  return questName;
}



  // =========================================================
  // OBJECTIVES
  // =========================================================

  function showObjectives() {
    stopCamera();

    const active =
      Object.entries(save.quests)
        .filter(
          ([, status]) =>
            status === "active"
        )
        .map(
          ([name]) => name
        );

    const body =
      active.length
        ? `
          <div class="list">
            ${
              active
                .map(
                  q => `
                    <div class="list-item">
                      ◇ ${esc(getQuestDisplayName(q))}
                    </div>
                  `
                )
                .join("")
            }
          </div>
        `
        : `
          <div class="empty">
            ${esc(TEXT.noActiveObjectives)}
          </div>
        `;

    shell(`
      <section class="card screen-card">

        <h1 class="screen-title">
          ${esc(TEXT.objectivesTitle)}
        </h1>

        <p class="screen-subtitle">
          ${esc(TEXT.objectivesSubtitle)}
        </p>

        ${body}

      </section>
    `, {
      back: showHome
    });
  }


  // =========================================================
// THINGS I KNOW
// =========================================================

  function showThingsIKnow() {
    stopCamera();
  
    currentEncounter = null;
    currentItemName = null;
    currentPageId = null;
  
    const definitions =
      GAME.thingsIKnow &&
      typeof GAME.thingsIKnow === "object"
        ? GAME.thingsIKnow
        : {};
  
    const folders =
      GAME.knowledgeFolders &&
      typeof GAME.knowledgeFolders === "object"
        ? GAME.knowledgeFolders
        : {};
  
    const known =
      (save.knowledge || [])
        .map(id => ({
          id,
          data: definitions[id]
        }))
        .filter(
          entry =>
            entry.data &&
            typeof entry.data === "object" &&
            typeof entry.data.text === "string"
        );
  
    let body;
  
    if (!known.length) {
      body = `
        <div class="empty">
          ${esc(
            d(
              "You haven't learned anything yet.",
              "Még nem tudtál meg semmit."
            )
          )}
        </div>
      `;
    } else {
      const usedFolders =
        [
          ...new Set(
            known.map(
              entry =>
                entry.data.folder || "other"
            )
          )
        ];
  
      const configuredOrder =
        Object.keys(folders);
  
      usedFolders.sort((a, b) => {
        const aIndex =
          configuredOrder.indexOf(a);
  
        const bIndex =
          configuredOrder.indexOf(b);
  
        if (
          aIndex !== -1 &&
          bIndex !== -1
        ) {
          return aIndex - bIndex;
        }
  
        if (aIndex !== -1) {
          return -1;
        }
  
        if (bIndex !== -1) {
          return 1;
        }
  
        return String(a)
          .localeCompare(String(b));
      });
  
      body =
        usedFolders
          .map(folderId => {
            const folderName =
              folders[folderId] ||
              folderId;
  
            const entries =
              known.filter(
                entry =>
                  (
                    entry.data.folder ||
                    "other"
                  ) === folderId
              );
  
            return `
              <div
                style="
                  margin-bottom:24px;
                "
              >
                <h2
                  style="
                    margin:0 0 10px;
                    font-size:1.2rem;
                  "
                >
                  ${esc(folderName)}
                </h2>
  
                <div class="list">
  
                  ${entries
                    .map(
                      entry => `
                        <div class="list-item">
                          • ${esc(entry.data.text)}
                        </div>
                      `
                    )
                    .join("")}
  
                </div>
              </div>
            `;
          })
          .join("");
    }
  
    shell(`
      <section class="card screen-card">
  
        <h1 class="screen-title">
          ${esc(
            d(
              "Things I Know",
              "Amit tudok"
            )
          )}
        </h1>
  
        <p class="screen-subtitle">
          ${esc(
            d(
              "Useful things you have learned during your adventure.",
              "Hasznos dolgok, amiket a kalandod során megtudtál."
            )
          )}
        </p>
  
        ${body}
  
      </section>
    `, {
      back: showHome
    });
  }


  // =========================================================
  // SETTINGS
  // =========================================================

  function isDebugEnabled() {
    return DEBUG || secretDebugVisible;
  }

  function showSettings() {
    play?.close();
    stopCamera();

    shell(`
      <section class="card screen-card settings-screen">
        <h1 class="screen-title">${esc(TEXT.settings)}</h1>
        <nav class="settings-menu" aria-label="${esc(TEXT.settings)}">
          <button class="settings-option" id="settingsModsBtn" type="button">
            <span>
              <span class="settings-option-label">🧩 ${esc(TEXT.mods)}</span>
              <span class="settings-option-detail">${esc(TEXT.modsDescription)}</span>
            </span>
            <span aria-hidden="true">›</span>
          </button>
          <button class="settings-option" id="settingsLanguageBtn" type="button">
            <span>
              <span class="settings-option-label">🌐 ${esc(TEXT.language)}</span>
              <span class="settings-option-detail">${esc(TEXT.languageDescription)}</span>
            </span>
            <span aria-hidden="true">›</span>
          </button>
          ${isDebugEnabled() ? `
            <button class="settings-option" id="settingsDebugBtn" type="button">
              <span>
                <span class="settings-option-label">🛠 ${esc(TEXT.debugTools)}</span>
                <span class="settings-option-detail">${esc(TEXT.debugDescription)}</span>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          ` : ""}
        </nav>
      </section>
    `, { back: showHome });

    document.getElementById("settingsModsBtn").onclick = showModsSettings;
    document.getElementById("settingsLanguageBtn").onclick = showLanguageSettings;

    const debugEntry = document.getElementById("settingsDebugBtn");
    if (debugEntry) {
      debugEntry.onclick = showDebug;
    }
  }


  async function showModsSettings(message = "") {
    stopCamera();

    shell(`
      <section class="card screen-card settings-screen">
        <h1 class="screen-title">${esc(TEXT.mods)}</h1>
        <p class="settings-hint" id="modsStatus" role="status" aria-live="polite">${esc(message || TEXT.modsInstallHelp)}</p>
        <div class="mods-install-row">
          <button class="primary" type="button" id="installModBtn">${esc(TEXT.installMod)}</button>
          <input type="file" accept=".zip,application/zip" id="modFileInput" hidden>
          <button class="secondary" type="button" id="modsReloadBtn">${esc(TEXT.modsApplyChanges)}</button>
        </div>
        <div id="installedMods" class="mods-list">${esc(TEXT.modsLoading)}</div>
        <p class="mods-note">${esc(TEXT.modsNotYetPlayable)}</p>
      </section>
    `, { back: showSettings });

    const api = window.QRCQModInstaller;
    const picker = document.getElementById("modFileInput");
    const installButton = document.getElementById("installModBtn");
    const status = document.getElementById("modsStatus");
    const reloadButton = document.getElementById("modsReloadBtn");
    reloadButton.onclick = () => location.reload();
    let working = false;

    function setStatus(text) {
      if (document.getElementById("modsStatus") === status) status.textContent = text;
    }

    async function runTask(action) {
      if (working) return;
      working = true;
      installButton.disabled = true;
      document.querySelectorAll("[data-mod-toggle], [data-mod-remove]").forEach(b => { b.disabled = true; });
      try {
        await action();
      } catch (error) {
        console.error("Mod manager:", error);
        setStatus(error && error.message ? error.message : TEXT.modOperationFailed);
      } finally {
        working = false;
        if (document.getElementById("installModBtn") === installButton)
          installButton.disabled = !api;
      }
    }

    async function refreshMods() {
      const rows = await api.list();
      const region = document.getElementById("installedMods");
      if (!region) return;

      if (!rows.length) {
        region.innerHTML = `<p class="mods-empty">${esc(TEXT.noModsInstalled)}</p>`;
        return;
      }

      region.innerHTML = rows.map(mod => `
        <article class="mod-card">
          <div class="mod-card-heading">
            <strong>${esc(mod.name)}</strong>
            <span class="mod-state">${esc(mod.enabled ? TEXT.modEnabled : TEXT.modDisabled)}</span>
          </div>
          <div class="mod-meta">${esc(mod.id)} · v${esc(mod.version)} ·
            ${esc(mod.kind === "language" ? TEXT.modLanguagePack : TEXT.modExpansion)}</div>
          ${mod.target ? `<p class="mod-meta">${esc(TEXT.modTarget)}: ${esc(mod.target)}</p>` : ""}
          <p class="mod-meta">${esc(TEXT.modLanguages)}: ${esc(mod.languages.join(", "))}</p>
          ${mod.description ? `<p class="mod-description">${esc(mod.description)}</p>` : ""}
          <div class="mod-actions">
            <button class="secondary" type="button" data-mod-toggle="${esc(mod.id)}" data-mod-enable="${!mod.enabled}">
              ${esc(mod.enabled ? TEXT.disableMod : TEXT.enableMod)}
            </button>
            <button class="secondary" type="button" data-mod-remove="${esc(mod.id)}">
              ${esc(TEXT.removeMod)}
            </button>
          </div>
        </article>
      `).join("");

      region.querySelectorAll("[data-mod-toggle]").forEach(button => {
        button.onclick = () => runTask(async () => {
          const id = button.dataset.modToggle;
          const enabled = button.dataset.modEnable === "true";
          const changed = await api.setEnabled(id, enabled);
          setStatus(changed.name + ": " + (enabled ? TEXT.modEnabled : TEXT.modDisabled) + " — " + TEXT.modsRestartNeeded);
          await refreshMods();
        });
      });

      region.querySelectorAll("[data-mod-remove]").forEach(button => {
        button.onclick = () => {
          if (!confirm(TEXT.confirmRemoveMod)) return;
          runTask(async () => {
            await api.remove(button.dataset.modRemove);
            setStatus(TEXT.modRemoved + " " + TEXT.modsRestartNeeded);
            await refreshMods();
          });
        };
      });
    }

    if (!api) {
      setStatus(TEXT.modManagerUnavailable);
      installButton.disabled = true;
      return;
    }

    installButton.onclick = () => picker.click();
    picker.onchange = () => {
      const selected = picker.files && picker.files[0];
      picker.value = "";
      if (!selected) return;
      runTask(async () => {
        setStatus(TEXT.modsInstalling);
        const installed = await api.install(selected);
        setStatus(TEXT.modInstalled(installed.name) + " " + TEXT.modsRestartNeeded);
        await refreshMods();
      });
    };

    try {
      await refreshMods();
    } catch (error) {
      console.error("Mod storage:", error);
      setStatus(TEXT.modStorageUnavailable + " " + error.message);
      installButton.disabled = true;
    }
  }

  function showLanguageSettings() {
    stopCamera();

    const languages = window.QR_CITY_QUEST_AVAILABLE_LANGUAGES || [
      { code: "en", name: "English" },
      { code: "hu", name: "Magyar" }
    ];

    shell(`
      <section class="card screen-card settings-screen">
        <h1 class="screen-title">${esc(TEXT.language)}</h1>
        <p class="settings-hint">${esc(TEXT.selectLanguage)}</p>
        <div class="settings-menu">
          ${languages.map(({ code, name }) => `
            <button class="settings-option" type="button"
              data-language-option="${code}"
              aria-pressed="${code === LANGUAGE}">
              <span class="settings-option-label">${esc(name)}</span>
              <span aria-hidden="true">${code === LANGUAGE ? "✓" : ""}</span>
            </button>
          `).join("")}
        </div>
      </section>
    `, { back: showSettings });

    document.querySelectorAll("[data-language-option]").forEach(button => {
      button.onclick = () => {
        const selected = button.dataset.languageOption;
        if (selected === LANGUAGE) return;
        if (typeof window.QR_CITY_QUEST_SET_LANGUAGE === "function") {
          window.QR_CITY_QUEST_SET_LANGUAGE(selected);
        }
      };
    });
  }

  // =========================================================
  // QR SCANNER
  // =========================================================

  function showScanner() {
    stopCamera();
    play?.close();

    scannerLocked = false;

    const secure =
      window.isSecureContext ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1";

    shell(`
      <section class="card scanner-card">

        <div
          class="camera-wrap"
          style="
            position: relative;
            overflow: hidden;
            border-radius: 18px;
            background: #000;
          "
        >

          <video
            id="cameraVideo"
            autoplay
            playsinline
            muted
            aria-label="${esc(TEXT.qrCameraPreview)}"
            style="
              display: block;
              width: 100%;
              min-height: 320px;
              aspect-ratio: 3 / 4;
              object-fit: cover;
              background: #000;
            "
          ></video>

          <div
            class="scan-frame"
            aria-hidden="true"
          ></div>

          <div
            class="camera-message"
            id="cameraMessage"
            aria-live="polite"
          ></div>

        </div>
        <form id="manual-scan" class="manual-scan">
          <label for="manual-qr">${esc(d("QR code", "QR-kód"))}</label>
          <input id="manual-qr" required autocomplete="off">
          <button type="submit">${esc(TEXT.scanQR)}</button>
        </form>
      </section>
    `, {
      back: showHome
    });

    document.getElementById("manual-scan").onsubmit = event => {
      event.preventDefault();
      scannerLocked = false;
      acceptScannedText(document.getElementById("manual-qr").value);
    };
    if (!secure) {
      const msg =
        document.getElementById(
          "cameraMessage"
        );

      if (msg) {
        msg.textContent =
          TEXT.cameraRequiresHttps;
      }

      return;
    }

    startCameraScanner();
  }


  async function startCameraScanner() {
    const msg =
      document.getElementById(
        "cameraMessage"
      );

    const video =
      document.getElementById(
        "cameraVideo"
      );

    if (
      !video ||
      !msg
    ) {
      return;
    }

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      msg.textContent =
        TEXT.cameraUnavailable;

      return;
    }

    if (!window.ZXingBrowser) {
      msg.textContent =
        TEXT.qrScannerCouldNotLoad;

      return;
    }

    try {
      scannerLocked = false;

      const codeReader =
        new ZXingBrowser
          .BrowserQRCodeReader();

      zxingControls =
        await codeReader
          .decodeFromConstraints(

            {
              audio: false,

              video: {
                facingMode: {
                  ideal: "environment"
                }
              }
            },

            video,

            (
              result,
              error,
              controls
            ) => {

              if (
                !result ||
                scannerLocked
              ) {
                return;
              }

              zxingControls =
                controls;

              const text =
                result.getText();

              console.log(
                "QR scanned:",
                text
              );

              acceptScannedText(
                text
              );
            }
          );

      if (
        video.srcObject
        instanceof MediaStream
      ) {
        cameraStream =
          video.srcObject;
      }

      msg.textContent = "";

    } catch (err) {

      console.error(
        "QR camera error:",
        err
      );

      if (
        err &&
        err.name ===
          "NotAllowedError"
      ) {
        msg.textContent =
          TEXT.cameraPermissionDenied;

      } else if (
        err &&
        err.name ===
          "NotFoundError"
      ) {
        msg.textContent =
          TEXT.noCameraFound;

      } else {
        msg.textContent =
          TEXT.cameraCouldNotStart;
      }
    }
  }


  async function acceptScannedText(raw) {
    if (uiBusy || scannerLocked) {
      return;
    }

    const qr =
      String(raw ?? "")
        .trim();
    if (play) {
      stopCamera();
      return runAdventureInteraction(() => play.scan(qr));
    }

    const encounterExists =
      isValidGameQr(qr) &&
      GAME.encounters &&
      GAME.encounters[qr];

    const item =
      isValidGameQr(qr)
        ? getItemDefinitionByQr(qr)
        : null;

    if (
      !encounterExists &&
      !item
    ) {
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
      const ownsItem =
        save.inventory.includes(
          item.name
        );

      const hadItemBefore =
        save.hadItems.includes(
          item.name
        );

      // First-ever acquisition from a physical item QR.
      // Keep hadItems as the permanent collection history.
      if (!hadItemBefore) {
        if (!ownsItem) {
          save.inventory.push(
            item.name
          );
        }

        save.hadItems.push(
          item.name
        );

        if (!await persist()) return;

        if (!ownsItem) {
          toast(
            TEXT.itemAddedToInventory(
              getItemDisplayName(
                item.name
              )
            )
          );
        }

        openItemDialogue(
          item.name
        );
        return;
      }

      // Already collected and still owned: allow normal item use,
      // but never create a duplicate copy.
      if (ownsItem) {
        openItemDialogue(
          item.name
        );
        return;
      }

      // Already collected but later consumed/traded/lost:
      // the physical QR cannot be used to reclaim the item.
      showHome();
      toast(
        TEXT.itemAlreadyCollected
      );
      return;
    }
  }


  // =========================================================
  // ENCOUNTERS
  // =========================================================

  async function resolveScan(encounterId) {
    const encounter =
      GAME.encounters[
        encounterId
      ];

    if (!encounter) {
      return showUnknownQR();
    }

    // AREA LOCK CHECK
    if (
      encounter.requiredArea &&
      !save.flags.unlockedAreas.includes(
        encounter.requiredArea
      )
    ) {
      return showAreaLocked();
    }

    currentEncounter =
      encounterId;

    currentItemName =
      null;

    const savedPage =
      save.encounters[
        encounterId
      ] ||
      encounter.startPage;

    // Some encounters (for example the library) can have several
    // independent item timers running at once. When the encounter is
    // otherwise at its normal start page, an expired timer can redirect
    // the player to the configured overdue page.
    if (
      savedPage === encounter.startPage &&
      encounter.overdueItemTimers &&
      typeof encounter.overdueItemTimers === "object"
    ) {
      for (
        const [itemName, overduePage]
        of Object.entries(
          encounter.overdueItemTimers
        )
      ) {
        const itemTimer =
          save.itemTimers[
            itemName
          ];

        if (
          save.inventory.includes(
            itemName
          ) &&
          itemTimer &&
          Date.now() >=
            Number(itemTimer.endAt) &&
          findPage(
            String(overduePage)
          )
        ) {
          return showPage(
            String(overduePage)
          );
        }
      }
    }

    if (
      savedPage !== "-1"
    ) {
      return showPage(
        savedPage
      );
    }

    const timer =
      save.timers[
        encounterId
      ];

    if (!timer) {
      return showDataError(
        TEXT.encounterWaitingWithoutTimer(
          encounterId
        )
      );
    }

    if (
      Date.now() <
      Number(timer.endAt)
    ) {
      if (
        timer.waitPage &&
        findPage(timer.waitPage)
      ) {
        return showPage(
          timer.waitPage
        );
      }

      return showTimerWait(
        encounterId,
        timer
      );
    }

    if (
      !findPage(
        timer.resumePage
      )
    ) {
      return showDataError(
        TEXT.timerMissingPage(
          encounterId,
          timer.resumePage
        )
      );
    }

    save.encounters[
      encounterId
    ] =
      timer.resumePage;

    delete save.timers[
      encounterId
    ];

    if (!await persist()) return;

    showPage(
      timer.resumePage
    );
  }


  // =========================================================
  // PAGE LOOKUP
  // =========================================================

  function findPageContext(pageId) {
    const id =
      String(
        pageId ?? ""
      );

    const colon = id.indexOf(":");
    const encounterId =
      colon >= 0
        ? id.slice(0, colon + 3)
        : id.slice(0, 2);

    const encounter =
      GAME.encounters &&
      GAME.encounters[
        encounterId
      ];

    if (
      encounter &&
      encounter.pages &&
      encounter.pages[id]
    ) {
      return {
        type: "encounter",
        encounterId,
        itemName: null,
        page: encounter.pages[id]
      };
    }

    if (GAME.items) {
      for (
        const [itemName, item]
        of Object.entries(
          GAME.items
        )
      ) {
        if (
          item &&
          item.pages &&
          item.pages[id]
        ) {
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
    const context =
      findPageContext(pageId);

    return context
      ? context.page
      : null;
  }


  // =========================================================
  // TIMER WAIT SCREEN
  // =========================================================

  function showTimerWait(
    encounterId,
    timer
  ) {
    currentEncounter =
      encounterId;

    currentItemName =
      null;

    currentPageId =
      "-1";

    const mins =
      Math.max(
        1,
        Math.ceil(
          (
            Number(timer.endAt) -
            Date.now()
          ) / 60000
        )
      );

    shell(`
      <section class="card screen-card encounter-card">

        <div class="speaker-row">

          <div class="speaker">
            ${esc(TEXT.waiting)}
          </div>

          ${
            DEBUG
              ? `
                <div class="page-id">
                  ${esc(
                    TEXT.timerDebugLabel(
                      mins
                    )
                  )}
                </div>
              `
              : ""
          }

        </div>

        <p class="dialogue">
          ${esc(TEXT.timerNothingToDo)}
        </p>

        <div class="choices">

          <button
            class="choice-btn"
            id="timerBye"
            type="button"
          >
            ${esc(TEXT.bye)}
          </button>

        </div>

      </section>
    `, {
      back: showHome
    });

    document
      .getElementById("timerBye")
      .onclick = showHome;
  }


  // =========================================================
  // PAGE DISPLAY
  // =========================================================

  function getPagePicture(page, context) {
    const specific =
      page &&
      typeof page.picture === "string" &&
      page.picture.trim()
        ? page.picture.trim()
        : null;

    if (specific) {
      return specific;
    }

    if (context && context.type === "encounter") {
      const encounter =
        GAME.encounters &&
        GAME.encounters[context.encounterId];

      if (
        encounter &&
        typeof encounter.defaultPicture === "string" &&
        encounter.defaultPicture.trim()
      ) {
        return encounter.defaultPicture.trim();
      }
    }

    if (context && context.type === "item") {
      const item =
        GAME.items &&
        GAME.items[context.itemName];

      if (
        item &&
        typeof item.defaultPicture === "string" &&
        item.defaultPicture.trim()
      ) {
        return item.defaultPicture.trim();
      }
    }

    return null;
  }

  function showPage(pageId) {
    stopCamera();

    const context =
      findPageContext(pageId);

    if (!context) {
      return showDataError(
        TEXT.pageDoesNotExist(
          pageId
        )
      );
    }

    const page =
      context.page;

    currentEncounter =
      context.encounterId;

    currentItemName =
      context.itemName;

    currentPageId =
      page.id;

    transitionLocked =
      false;

    const dropdown =
      page.actions.find(
        a =>
          a.type ===
            "DROPDOWN_INVENTORY" ||
          a.type ===
            "DROPDOWN_CHOICE"
      );

    let controls = "";

    if (dropdown) {
      const data =
        dropdownUI(dropdown);

      controls = `
        <div class="dropdown-wrap">

          ${
            data.empty
              ? `
                <div class="empty">
                  ${esc(TEXT.noItems)}
                </div>
              `
              : `
                <select
                  id="dropdownSelect"
                  aria-label="${esc(TEXT.chooseOption)}"
                >

                  <option value="">
                    ${esc(TEXT.choosePlaceholder)}
                  </option>

                  ${
                    data.options
                      .map(
                        o => `
                          <option
                            value="${esc(o.value)}"
                          >
                            ${esc(o.label)}
                          </option>
                        `
                      )
                      .join("")
                  }

                </select>
              `
          }

          <button
            class="primary"
            id="dropdownConfirm"
            type="button"
          >
            ${esc(TEXT.confirm)}
          </button>

        </div>
      `;

    } else {
      const buttons =
        visibleButtons(
          page,
          context
        );

      controls =
        buttons.length
          ? `
            <div class="choices">

              ${
                buttons
                  .map(
                    b => `
                      <button
                        class="choice-btn"
                        type="button"
                        data-button-index="${b.index}"
                        data-next="${esc(
                          b.next || ""
                        )}"
                      >

                        ${
                          DEBUG
                            ? `
                              <span class="num">
                                ${b.index}
                              </span>
                            `
                            : ""
                        }

                        ${esc(b.label)}

                      </button>
                    `
                  )
                  .join("")
              }

            </div>
          `
          : `
            <div class="empty">
              ${esc(
                TEXT.noChoicesAvailable
              )}
            </div>
          `;
    }

    const picture =
      getPagePicture(page, context);

    const pictureSrc = pictureUrl(picture);

    const pictureMarkup =
      pictureSrc
        ? `
          <div class="encounter-picture">
            <img
              src="${esc(pictureSrc)}"
              alt="${esc(page.speaker || TEXT.encounterFallback)}"
              class="encounter-picture-image"
              decoding="async"
            >
          </div>
        `
        : "";

    shell(`
      <section class="card screen-card encounter-card">

        <div class="speaker-row">

          <div class="speaker">
            ${esc(
              page.speaker ||
              TEXT.encounterFallback
            )}
          </div>

          ${
            DEBUG
              ? `
                <div class="page-id">
                  ${esc(page.id)}
                </div>
              `
              : ""
          }

        </div>

        <p class="dialogue">${esc(String(page.text ?? "").trim())}</p>  

        ${controls}
        ${pictureMarkup}

      </section>
    `, {
      back:
        context.type === "item"
          ? showInventory
          : showHome
    });

    const pictureImage =
      document.querySelector(
        ".encounter-picture-image"
      );

    if (pictureImage) {
      pictureImage.onerror = () => {
        const wrapper =
          pictureImage.closest(
            ".encounter-picture"
          );

        if (wrapper) {
          wrapper.remove();
        }
      };
    }

    if (dropdown) {
      const confirm =
        document.getElementById(
          "dropdownConfirm"
        );

      if (confirm) {
        confirm.onclick =
          () =>
            confirmDropdown(
              page,
              dropdown
            );
      }

    } else {
      document
        .querySelectorAll(
          "[data-button-index]"
        )
        .forEach(button => {

          button.onclick =
            () =>
              handleTransition(
                page,
                Number(
                  button.dataset
                    .buttonIndex
                ),
                button.dataset.next
              );

        });
    }
  }


  // =========================================================
  // BUTTON CONDITIONS
  // =========================================================

   function checkButtonCondition(condition, page, button, context) {
    if (play) return false;
    if (
      condition === undefined ||
      condition === null ||
      condition === ""
    ) {
      return true;
    }
  
    try {
      const had_item = save.hadItems;
      const knowledge = save.knowledge;
      /*
       * counter("eatAttempts")
       *
       * On an item page this automatically means:
       * current item + eatAttempts
       *
       * You can also explicitly specify an item:
       *
       * counter("eatAttempts", "Sweets")
       */
      const counter = (name, itemName = null) => {
        const resolvedItem =
          itemName ||
          (
            context &&
            context.type === "item"
              ? context.itemName
              : null
          );
  
        if (!resolvedItem) {
          return 0;
        }
  
        return Number(
          save.itemState.counters[
            counterKey(
              resolvedItem,
              String(name)
            )
          ] || 0
        );
      };
  
      // Downloaded mod conditions use a restricted data-only interpreter.
      if (page && page.__modId) {
        return !!window.QRCQModConditions.evaluate(
          condition, { save }, page.__modId, context
        );
      }
      // Legacy built-in condition strings belong to the trusted base game.
      return !!eval(condition);
  
    } catch (error) {
      console.error(
        "Button condition error:",
        {
          pageId: page && page.id,
          buttonIndex: button && button.index,
          condition,
          error
        }
      );
  
      return false;
    }
  }


  function visibleButtons(
    page,
    context
  ) {
    const conditions =
      page &&
      page.condition &&
      typeof page.condition === "object"
        ? page.condition
        : {};

    return page.buttons.filter(
      button => {
        const condition =
          conditions[button.index];

        return checkButtonCondition(
          condition,
          page,
          button,
          context
        );
      }
    );
  }


  // =========================================================
  // DROPDOWNS
  // =========================================================

  function dropdownUI(action) {
    if (
      action.type ===
      "DROPDOWN_CHOICE"
    ) {
      const choiceOptions =
        Array.isArray(action.options)
          ? action.options
          : [];

      return {
        empty:
          choiceOptions.length === 0,

        options:
          choiceOptions.map(
            o => ({
              label: o.label,
              value: o.label
            })
          )
      };
    }

    const specialOptions =
      Array.isArray(action.options)
        ? action.options
        : [];

    const options =
      save.inventory.map(
        itemName => {

          const matchingOption =
            specialOptions.find(
              option =>
                String(
                  option.value ??
                  option.label ??
                  ""
                ) === itemName
            );

          return {
            value: itemName,
            label:
              (
                matchingOption &&
                matchingOption.label
              ) ||
              getItemDisplayName(
                itemName
              )
          };
        }
      );

    return {
      empty:
        options.length === 0,

      options
    };
  }


  function confirmDropdown(
    page,
    action
  ) {
    if (uiBusy || currentPageId !== page.id || !page.actions.includes(action)) return;
    const select =
      document.getElementById(
        "dropdownSelect"
      );
  
    let destination = null;
  
    const options =
      Array.isArray(action.options)
        ? action.options
        : [];
  
  
    // =========================================
    // NORMAL CHOICE DROPDOWN
    // =========================================
  
    if (
      action.type ===
      "DROPDOWN_CHOICE"
    ) {
      if (
        !select ||
        !select.value
      ) {
        return toast(
          TEXT.chooseOptionFirst
        );
      }
  
      const match =
        options.find(
          option =>
            option.label ===
              select.value ||
            option.value ===
              select.value
        );
  
      destination =
        match &&
        match.next;
    }
  
  
    // =========================================
    // INVENTORY DROPDOWN
    // =========================================
  
    else if (
      action.type ===
      "DROPDOWN_INVENTORY"
    ) {
  
      const selectedItem =
        select &&
        select.value
          ? select.value
          : null;
  
  
      // Nothing selected OR inventory empty:
      // go to the normal "wrong/no item" page.
      if (!selectedItem) {
  
        if (action.otherNext) {
          destination =
            action.otherNext;
        }
  
        // Backward compatibility
        else {
          const oldOther =
            options.find(
              option =>
                option.label ===
                "Other"
            );
  
          destination =
            oldOther &&
            oldOther.next;
        }
  
      } else {
  
        const matchingOption =
          options.find(
            option =>
              (
                option.value ??
                option.label
              ) ===
              selectedItem
          );
  
        if (matchingOption) {
  
          destination =
            matchingOption.next;
  
        } else if (
          action.otherNext
        ) {
  
          destination =
            action.otherNext;
  
        } else {
  
          const oldOther =
            options.find(
              option =>
                option.label ===
                "Other"
            );
  
          destination =
            oldOther &&
            oldOther.next;
        }
      }
    }
  
  
    if (!destination) {
      return showDataError(
        TEXT.noDropdownDestination(
          page.id
        )
      );
    }
  
  
    handleTransition(
      page,
      1,
      destination,
      dropdownTransition
    );
  }


  // =========================================================
  // GENERIC COUNTERS
  // =========================================================

  function counterKey(itemName, name) {
    return `${itemName}::${name}`;
  }


  function getCounterValue(itemName, name) {
    return Number(
      save.itemState.counters[
        counterKey(itemName, name)
      ] || 0
    );
  }


  function getCounterActionTarget(action, context) {
    const itemName =
      (
        typeof action.item === "string" &&
        action.item.trim()
      )
        ? action.item.trim()
        : (
            context &&
            context.type === "item"
              ? context.itemName
              : null
          );

    const counterName =
      typeof action.data === "string"
        ? action.data.trim()
        : "";

    return {
      itemName,
      counterName
    };
  }


  function counterActionMatchesButton(action, buttonIndex) {
    if (
      action.buttonIndex === undefined ||
      action.buttonIndex === null
    ) {
      return true;
    }

    if (Array.isArray(action.buttonIndex)) {
      return action.buttonIndex
        .map(Number)
        .includes(
          Number(buttonIndex)
        );
    }

    return (
      Number(action.buttonIndex) ===
      Number(buttonIndex)
    );
  }


  // =========================================================
  // TRANSITIONS / ACTIONS
  // =========================================================

  async function handleTransition(
    page,
    buttonIndex,
    destination,
    source
  ) {
    if (uiBusy || transitionLocked || currentPageId !== page.id) {
      return;
    }
    const selected = page.buttons.find(button => Number(button.index) === buttonIndex);
    if (source !== dropdownTransition && selected?.next !== destination) return;
    if (selected && !checkButtonCondition(page.condition?.[buttonIndex], page, selected, findPageContext(page.id))) return;

    transitionLocked =
      true;

    if (!destination) {
      return showDataError(
        TEXT.buttonHasNoDestination(
          buttonIndex,
          page.id
        )
      );
    }

    const context =
      findPageContext(
        page.id
      );

    let mutated =
      false;

    let timerStarted =
      false;

    let nextScan =
      false;


    for (
      const action
      of page.actions
    ) {
      switch (action.type) {

        case "ADD_ITEM": {
          if (
            action.data &&
            !save.inventory.includes(
              action.data
            )
          ) {
            save.inventory.push(
              action.data
            );

            mutated =
              true;
          }

          if (
            action.data &&
            !save.hadItems.includes(
              action.data
            )
          ) {
            save.hadItems.push(
              action.data
            );

            mutated =
              true;
          }

          break;
        }


        case "REMOVE_ITEM": {
          const before =
            save.inventory.length;

          save.inventory =
            save.inventory.filter(
              item =>
                item !==
                action.data
            );

          if (
            save.inventory.length !==
            before
          ) {
            mutated =
              true;
          }

          break;
        }

        case "ADD_KNOWLEDGE": {
          const knowledgeId =
            typeof action.data === "string"
              ? action.data.trim()
              : "";
        
          if (!knowledgeId) {
            return showDataError(
              d(
                `ADD_KNOWLEDGE has no knowledge ID on page ${page.id}.`,
                `Az ADD_KNOWLEDGE actionnek nincs knowledge ID-je ezen az oldalon: ${page.id}.`
              )
            );
          }
        
          if (
            !GAME.thingsIKnow ||
            !GAME.thingsIKnow[knowledgeId]
          ) {
            return showDataError(
              d(
                `Unknown Things I Know ID "${knowledgeId}" on page ${page.id}.`,
                `Ismeretlen Things I Know ID: "${knowledgeId}" ezen az oldalon: ${page.id}.`
              )
            );
          }
        
          if (
            !save.knowledge.includes(
              knowledgeId
            )
          ) {
            save.knowledge.push(
              knowledgeId
            );
        
            mutated = true;
          }
        
          break;
        }
          
        case "START_QUEST":

          if (
            save.quests[action.data] !==
              "completed" &&
            save.quests[action.data] !==
              "active"
          ) {
            save.quests[action.data] =
              "active";

            mutated =
              true;
          }

          break;


        case "COMPLETE_QUEST":

          if (
            save.quests[action.data] !==
            "completed"
          ) {
            save.quests[action.data] =
              "completed";

            mutated =
              true;
          }

          break;


        case "START_ITEM_TIMER": {
          const itemName =
            typeof action.data === "string"
              ? action.data.trim()
              : "";

          const durationMs =
            Number(
              action.durationMs
            );

          if (
            !itemName ||
            !Number.isFinite(
              durationMs
            ) ||
            durationMs <= 0
          ) {
            return showDataError(
              d(
                `START_ITEM_TIMER is invalid on page ${page.id}.`,
                `A START_ITEM_TIMER hibás ezen az oldalon: ${page.id}.`
              )
            );
          }

          const unlessHasItem =
            typeof action.unlessHasItem === "string"
              ? action.unlessHasItem.trim()
              : "";

          // Premium-style access can explicitly bypass the timer.
          if (
            unlessHasItem &&
            save.inventory.includes(
              unlessHasItem
            )
          ) {
            if (
              save.itemTimers[
                itemName
              ]
            ) {
              delete save.itemTimers[
                itemName
              ];

              mutated =
                true;
            }

            break;
          }

          save.itemTimers[
            itemName
          ] = {
            endAt:
              Date.now() +
              durationMs
          };

          mutated =
            true;

          break;
        }


        case "STOP_ITEM_TIMER": {
          const itemName =
            typeof action.data === "string"
              ? action.data.trim()
              : "";

          if (!itemName) {
            return showDataError(
              d(
                `STOP_ITEM_TIMER has no item on page ${page.id}.`,
                `A STOP_ITEM_TIMER actionnek nincs tárgya ezen az oldalon: ${page.id}.`
              )
            );
          }

          if (
            save.itemTimers[
              itemName
            ]
          ) {
            delete save.itemTimers[
              itemName
            ];

            mutated =
              true;
          }

          break;
        }


        case "START_TIMER":

          if (
            !context ||
            context.type !==
              "encounter"
          ) {
            return showDataError(
              TEXT.timerOnlyForEncounter(
                page.id
              )
            );
          }

          if (
            !isDialoguePageId(
              destination
            ) ||
            !findPage(
              destination
            )
          ) {
            return showDataError(
              TEXT.timerNeedsResumePage(
                page.id
              )
            );
          }

          save.encounters[
            context.encounterId
          ] = "-1";

          if (
            action.waitPage &&
            (
              !isDialoguePageId(
                String(action.waitPage)
              ) ||
              !findPage(
                String(action.waitPage)
              )
            )
          ) {
            return showDataError(
              d(
                `START_TIMER has an invalid waitPage on page ${page.id}.`,
                `A START_TIMER waitPage értéke érvénytelen ezen az oldalon: ${page.id}.`
              )
            );
          }

          save.timers[
            context.encounterId
          ] = {
            endAt:
              Date.now() +
              Number(
                action.durationMs
              ),

            resumePage:
              destination,

            waitPage:
              action.waitPage
                ? String(action.waitPage)
                : null
          };

          mutated =
            true;

          timerStarted =
            true;

          break;


        case "OPEN_CASTLE":

          if (
            !save.flags.castleOpen
          ) {
            save.flags.castleOpen =
              true;

            mutated =
              true;
          }

          break;


        case "UNLOCK_AREA":

          if (
            action.data &&
            !save.flags
              .unlockedAreas
              .includes(
                action.data
              )
          ) {
            save.flags
              .unlockedAreas
              .push(
                action.data
              );

            mutated =
              true;
          }

          break;

        case "ADD_COUNTER":
        case "SET_COUNTER":
        case "RESET_COUNTER": {
        
          if (
            !counterActionMatchesButton(
              action,
              buttonIndex
            )
          ) {
            break;
          }
        
          const {
            itemName,
            counterName
          } =
            getCounterActionTarget(
              action,
              context
            );
        
        
          if (!itemName) {
            return showDataError(
              TEXT.counterActionNeedsItem(
                action.type
              )
            );
          }
        
        
          if (!counterName) {
            return showDataError(
              TEXT.counterActionNeedsName(
                action.type
              )
            );
          }
        
        
          const key =
            counterKey(
              itemName,
              counterName
            );
        
        
          const oldValue =
            getCounterValue(
              itemName,
              counterName
            );
        
        
          let newValue =
            oldValue;
        
        
          if (
            action.type === "ADD_COUNTER"
          ) {
            const amount =
              action.amount === undefined
                ? 1
                : Number(action.amount);
        
            if (!Number.isFinite(amount)) {
              return showDataError(
                TEXT.counterActionInvalidNumber(
                  action.type
                )
              );
            }
        
            newValue =
              oldValue + amount;
          }
        
        
          if (
            action.type === "SET_COUNTER"
          ) {
            const value =
              Number(action.value);
        
            if (!Number.isFinite(value)) {
              return showDataError(
                TEXT.counterActionInvalidNumber(
                  action.type
                )
              );
            }
        
            newValue =
              value;
          }
        
        
          if (
            action.type === "RESET_COUNTER"
          ) {
            newValue = 0;
          }
        
        
          if (
            newValue !== oldValue
          ) {
            save.itemState.counters[key] =
              newValue;
        
            mutated = true;
          }
        
          break;
        }


        case "DROPDOWN_INVENTORY":
        case "DROPDOWN_CHOICE":
          break;


        case "NEXT_SCAN": {

          const matchesButton =
            action.buttonIndex === undefined ||
            action.buttonIndex === null
              ? buttonIndex === 1
              : counterActionMatchesButton(
                  action,
                  buttonIndex
                );

          if (matchesButton) {
            nextScan =
              true;
          }

          break;
        }


        default:

          return showDataError(
            TEXT.unknownAction(
              action.type,
              page.id
            )
          );
      }
    }


    if (timerStarted) {
      if (!await persist()) return;

      toast(
        TEXT.progressSavedTimer
      );

      return showHome();
    }


    if (nextScan) {

      if (
        !context ||
        context.type !==
          "encounter"
      ) {
        return showDataError(
          TEXT.nextScanOnlyForEncounter(
            page.id
          )
        );
      }

      if (
        !isDialoguePageId(
          destination
        ) ||
        !findPage(
          destination
        )
      ) {
        return showDataError(
          TEXT.nextScanInvalidPage(
            page.id,
            destination
          )
        );
      }

      save.encounters[
        context.encounterId
      ] =
        destination;

      if (!await persist()) return;

      return showHome();
    }


    if (destination === "TITLE_SCREEN") {
      save = QRCQAdventureCompletion.finishTrustedBuiltIn(save);
      if (!await persist()) return;
      return showAdventureVictory();
    }
    if (mutated) {
      if (!await persist()) return;
    }

    resolveDestination(
      destination
    );
  }


  function resolveDestination(
    destination
  ) {
    /*
     * These are internal engine commands,
     * NOT translated text.
     */
    if (
      destination === "HOME"
    ) {
      return showHome();
    }

    if (
      destination === "-1"
    ) {
      return showHome();
    }

    if (
      !isDialoguePageId(
        destination
      )
    ) {
      return showDataError(
        TEXT.unknownDestination(
          destination
        )
      );
    }

    if (
      !findPage(
        destination
      )
    ) {
      return showDataError(
        TEXT.pageDoesNotExist(
          destination
        )
      );
    }

    showPage(
      destination
    );
  }


  // =========================================================
  // WIN SCREEN
  // =========================================================

  function showUnknownQR() {
    stopCamera();

    shell(`
      <section class="card error-card screen-card">

        <div
          class="error-icon"
          aria-hidden="true"
        >
          ?
        </div>

        <h2>
          ${esc(TEXT.unknownQRTitle)}
        </h2>

        <p>
          ${esc(TEXT.unknownQRText)}
        </p>

        <div class="error-actions">

          <button
            class="primary"
            id="scanAgain"
            type="button"
          >
            ${esc(TEXT.scanAgain)}
          </button>

          <button
            class="secondary"
            id="homeFromError"
            type="button"
          >
            ${esc(TEXT.home)}
          </button>

        </div>

      </section>
    `, {
      back: showHome
    });

    document
      .getElementById("scanAgain")
      .onclick = showScanner;

    document
      .getElementById("homeFromError")
      .onclick = showHome;
  }


  // =========================================================
  // DATA ERROR
  // =========================================================

  function showDataError(
    detail
  ) {
    if (transitionLocked && !uiBusy && !play) save = session.saved();
    stopCamera();

    console.error(
      "QR City Quest data error:",
      detail
    );

    shell(`
      <section class="card error-card screen-card">

        <div
          class="error-icon"
          aria-hidden="true"
        >
          !
        </div>

        <h2>
          ${esc(TEXT.somethingWentWrong)}
        </h2>

        <p>
          ${esc(TEXT.encounterDataProblem)}
        </p>

        ${
          DEBUG
            ? `
              <div class="notice">
                ${esc(detail)}
              </div>
            `
            : ""
        }

        <div class="error-actions">

          <button
            class="primary"
            id="errorHome"
            type="button"
          >
            ${esc(TEXT.home)}
          </button>

        </div>

      </section>
    `, {
      back: showHome
    });

    document
      .getElementById("errorHome")
      .onclick = showHome;
  }


  // =========================================================
  // DEBUG
  // =========================================================

  let debugSelectedItem = null;
  let debugSelectedQuest = null;
  let debugSelectedKnowledge = null;
  let debugSelectedCounter = null;


  function d(en, hu) {
    return LANGUAGE === "hu" ? hu : en;
  }


  function forEachGamePage(callback) {
    if (GAME.encounters) {
      for (
        const [encounterId, encounter]
        of Object.entries(GAME.encounters)
      ) {
        for (
          const page
          of Object.values(
            (encounter && encounter.pages) || {}
          )
        ) {
          callback(page, {
            type: "encounter",
            encounterId,
            itemName: null
          });
        }
      }
    }

    if (GAME.items) {
      for (
        const [itemName, item]
        of Object.entries(GAME.items)
      ) {
        for (
          const page
          of Object.values(
            (item && item.pages) || {}
          )
        ) {
          callback(page, {
            type: "item",
            encounterId: null,
            itemName
          });
        }
      }
    }
  }


  function allItemNames() {
    const names = new Set([
      ...(save.inventory || []),
      ...(save.hadItems || [])
    ]);

    if (GAME.items) {
      Object.keys(GAME.items)
        .forEach(name => names.add(name));
    }

    forEachGamePage(page => {
      for (
        const action
        of Array.isArray(page.actions)
          ? page.actions
          : []
      ) {
        if (
          (
            action.type === "ADD_ITEM" ||
            action.type === "REMOVE_ITEM" ||
            action.type === "START_ITEM_TIMER" ||
            action.type === "STOP_ITEM_TIMER"
          ) &&
          action.data
        ) {
          names.add(String(action.data));
        }

        if (
          action.type === "DROPDOWN_INVENTORY" &&
          Array.isArray(action.options)
        ) {
          for (const option of action.options) {
            const value = String(
              option.value ??
              option.label ??
              ""
            );

            if (
              value &&
              value !== "Other"
            ) {
              names.add(value);
            }
          }
        }
      }
    });

    return [...names].sort(
      (a, b) =>
        getItemDisplayName(a)
          .localeCompare(
            getItemDisplayName(b)
          )
    );
  }


  function allKnowledgeIds() {
    const ids = new Set(
      save.knowledge || []
    );

    if (
      GAME.thingsIKnow &&
      typeof GAME.thingsIKnow === "object"
    ) {
      Object.keys(GAME.thingsIKnow)
        .forEach(id => ids.add(id));
    }

    return [...ids].sort((a, b) => {
      const aText =
        GAME.thingsIKnow &&
        GAME.thingsIKnow[a] &&
        GAME.thingsIKnow[a].text
          ? GAME.thingsIKnow[a].text
          : a;

      const bText =
        GAME.thingsIKnow &&
        GAME.thingsIKnow[b] &&
        GAME.thingsIKnow[b].text
          ? GAME.thingsIKnow[b].text
          : b;

      return String(aText)
        .localeCompare(String(bText));
    });
  }


  function allQuestNames() {
    const names = new Set(
      Object.keys(save.quests || {})
    );

    if (
      GAME.questDisplayNames &&
      typeof GAME.questDisplayNames === "object"
    ) {
      Object.keys(GAME.questDisplayNames)
        .forEach(name => names.add(name));
    }

    forEachGamePage(page => {
      for (
        const action
        of Array.isArray(page.actions)
          ? page.actions
          : []
      ) {
        if (
          (
            action.type === "START_QUEST" ||
            action.type === "COMPLETE_QUEST"
          ) &&
          action.data
        ) {
          names.add(String(action.data));
        }
      }
    });

    return [...names].sort(
      (a, b) =>
        getQuestDisplayName(a)
          .localeCompare(
            getQuestDisplayName(b)
          )
    );
  }


  function allCounterDefinitions() {
    const counters = new Map();

    const addCounter = (
      itemName,
      counterName
    ) => {
      if (
        !itemName ||
        !counterName
      ) {
        return;
      }

      const key = counterKey(
        String(itemName),
        String(counterName)
      );

      counters.set(key, {
        key,
        itemName: String(itemName),
        counterName: String(counterName)
      });
    };

    for (
      const key
      of Object.keys(
        save.itemState.counters || {}
      )
    ) {
      const splitAt = key.indexOf("::");

      if (splitAt > 0) {
        addCounter(
          key.slice(0, splitAt),
          key.slice(splitAt + 2)
        );
      }
    }

    forEachGamePage((page, context) => {
      for (
        const action
        of Array.isArray(page.actions)
          ? page.actions
          : []
      ) {
        if (
          action.type === "ADD_COUNTER" ||
          action.type === "SET_COUNTER" ||
          action.type === "RESET_COUNTER"
        ) {
          const itemName =
            typeof action.item === "string" &&
            action.item.trim()
              ? action.item.trim()
              : (
                  context.type === "item"
                    ? context.itemName
                    : null
                );

          const counterName =
            typeof action.data === "string"
              ? action.data.trim()
              : "";

          addCounter(
            itemName,
            counterName
          );
        }
      }

      const conditions =
        page &&
        page.condition &&
        typeof page.condition === "object"
          ? Object.values(page.condition)
          : [];

      for (const condition of conditions) {
        if (
          typeof condition !== "string"
        ) {
          continue;
        }

        const regex =
          /counter\(\s*["']([^"']+)["']\s*(?:,\s*["']([^"']+)["'])?\s*\)/g;

        let match;

        while (
          (
            match = regex.exec(
              condition
            )
          )
        ) {
          addCounter(
            match[2] ||
              (
                context.type === "item"
                  ? context.itemName
                  : null
              ),
            match[1]
          );
        }
      }
    });

    return [...counters.values()]
      .sort((a, b) => {
        const itemCompare =
          getItemDisplayName(a.itemName)
            .localeCompare(
              getItemDisplayName(b.itemName)
            );

        if (itemCompare) {
          return itemCompare;
        }

        return a.counterName
          .localeCompare(b.counterName);
      });
  }


  function allAreaNames() {
    const names = new Set(
      save.flags.unlockedAreas || []
    );

    for (
      const encounter
      of Object.values(
        GAME.encounters || {}
      )
    ) {
      if (
        encounter &&
        encounter.requiredArea
      ) {
        names.add(
          String(encounter.requiredArea)
        );
      }
    }

    forEachGamePage(page => {
      for (
        const action
        of Array.isArray(page.actions)
          ? page.actions
          : []
      ) {
        if (
          action.type === "UNLOCK_AREA" &&
          action.data
        ) {
          names.add(String(action.data));
        }
      }
    });

    return [...names].sort();
  }


  function debugMenuButton(
    id,
    icon,
    title,
    subtitle
  ) {
    return `
      <button
        class="secondary"
        type="button"
        data-debug-menu="${esc(id)}"
        style="
          width:100%;
          min-height:100px;
          padding:16px 12px;
          text-align:left;
        "
      >
        <div style="font-size:1.55rem;margin-bottom:6px">
          ${esc(icon)}
        </div>
        <strong>${esc(title)}</strong>
        <div style="font-size:.82rem;opacity:.72;margin-top:4px">
          ${esc(subtitle)}
        </div>
      </button>
    `;
  }


  function showDebug() {
    if (play) {
      play.close();
      shell('<section class="card" id="download-debug"></section>', { back: showSettings });
      const panel = document.getElementById("download-debug");
      const heading = document.createElement("h2");
      heading.textContent = session.active.adventure.manifest.name;
      panel.append(heading);
      screenButton(panel, d("Simulate scan", "Beolvasás szimulálása"), () => {
        const qr = window.prompt(d("QR code", "QR-kód"));
        if (qr !== null) { scannerLocked = false; acceptScannedText(qr); }
      });
      const adventure = session.active.adventure;
      const routes = Object.values(adventure.scenarioData?.scenarios || {});
      const codes = new Set(routes.length ? routes.flatMap(route => route.sequence) : Object.keys(adventure.gameData.encounters));
      const select = document.createElement("select");
      select.setAttribute("aria-label", d("Encounter QR", "Találkozás QR-kódja"));
      for (const qr of codes) select.add(new Option(qr, qr));
      panel.append(select);
      screenButton(panel, d("Scan selected QR", "Kiválasztott QR-kód beolvasása"), () => {
        scannerLocked = false;
        acceptScannedText(select.value);
      });
      const state = play.getProgress();
      for (const [label, value] of [
        [TEXT.inventory, state.inventory], [TEXT.objectives, state.quests],
        [d("Flags and counters", "Jelzők és számlálók"), { flags: state.flags, counters: state.itemState.counters }],
        [d("Knowledge", "Ismeretek"), state.knowledge],
        [d("Timers", "Időzítők"), { encounters: state.timers, items: state.itemTimers }],
        [d("Save diagnostics", "Mentési diagnosztika"), state]
      ]) {
        const details = document.createElement("details");
        const labelNode = document.createElement("summary");
        labelNode.textContent = label;
        const diagnostics = document.createElement("pre");
        diagnostics.className = "adventure-diagnostics";
        diagnostics.textContent = JSON.stringify(value, null, 2);
        details.append(labelNode, diagnostics);
        panel.append(details);
      }
      return;
    }
    if (!isDebugEnabled()) return showSettings();
    stopCamera();

    shell(`
      <section class="card screen-card">

        <h1 class="screen-title">
          ${esc(TEXT.debugTools)}
        </h1>

        <p class="screen-subtitle">
          ${esc(TEXT.debugSubtitle)}
        </p>

        <div
          class="debug-menu-grid"
          style="
            display:grid;
            grid-template-columns:repeat(2,minmax(0,1fr));
            gap:10px;
          "
        >
          ${debugMenuButton(
            "encounters",
            "👤",
            d("Encounters", "Találkozások"),
            d("Scan, jump and progress", "Scan, ugrás és haladás")
          )}

          ${debugMenuButton(
            "inventory",
            "🎒",
            d("Inventory & Had Items", "Inventory és Had Items"),
            d("Add, remove and history", "Hozzáadás, törlés és előzmény")
          )}

          ${debugMenuButton(
            "quests",
            "🎯",
            d("Quests", "Küldetések"),
            d("Set quest states", "Küldetésállapotok")
          )}

          ${debugMenuButton(
            "knowledge",
            "📖",
            d("Things I Know", "Amit tudok"),
            d("Add or remove knowledge", "Tudás hozzáadása vagy törlése")
          )}

          ${debugMenuButton(
            "counters",
            "🔢",
            d("Counters", "Számlálók"),
            d("Inspect and edit values", "Értékek megtekintése és szerkesztése")
          )}

          ${debugMenuButton(
            "flags",
            "🗺️",
            d("Areas & Flags", "Területek és flagek"),
            d("Castle and area locks", "Kastély és területzárak")
          )}

          ${debugMenuButton(
            "timers",
            "⏱️",
            d("Timers", "Időzítők"),
            d("Expire or delete timers", "Időzítők lejáratása vagy törlése")
          )}

          <div style="grid-column:1 / -1">
            ${debugMenuButton(
              "save",
              "💾",
              d("Save Tools", "Mentés eszközök"),
              d("Raw save and reset tools", "Nyers mentés és reset eszközök")
            )}
          </div>
        </div>

      </section>
    `, {
      back: showSettings
    });

    const routes = {
      encounters: showDebugEncounters,
      inventory: showDebugInventory,
      quests: showDebugQuests,
      knowledge: showDebugKnowledge,
      counters: showDebugCounters,
      flags: showDebugFlags,
      timers: showDebugTimers,
      save: showDebugSaveTools
    };

    document
      .querySelectorAll(
        "[data-debug-menu]"
      )
      .forEach(button => {
        button.onclick = () => {
          const target =
            routes[
              button.dataset.debugMenu
            ];

          if (target) {
            target();
          }
        };
      });
  }


  function showDebugEncounters() {
    stopCamera();

    const encounterIds =
      Object.keys(GAME.encounters || {})
        .sort();

    shell(`
      <section class="card screen-card">

        <h1 class="screen-title">
          ${esc(d("Encounters", "Találkozások"))}
        </h1>

        <p class="screen-subtitle">
          ${esc(d(
            "Simulate a QR scan, jump to any page, or edit saved encounter progress.",
            "Szimulálj QR scant, ugorj bármelyik oldalra, vagy szerkeszd az encounter haladást."
          ))}
        </p>

        <div class="debug-section">
          <h3>${esc(d("Simulate scan", "Scan szimulálása"))}</h3>

          <div class="debug-grid">
            ${encounterIds
              .map(id => `
                <button
                  type="button"
                  data-debug-scan="${esc(id)}"
                >
                  ${esc(id)}
                </button>
              `)
              .join("")}
          </div>
        </div>

        <div class="debug-section">
          <h3>${esc(d("Developer override · jump to page", "Fejlesztői felülbírálás · ugrás oldalra"))}</h3>

          <div class="debug-row debug-jump-row">
            <input
              class="code-input debug-page-input"
              type="text"
              id="jumpPage"
              inputmode="text"
              autocapitalize="off"
              autocomplete="off"
              autocorrect="off"
              spellcheck="false"
              maxlength="80"
              aria-label="${esc(TEXT.jumpToPageId)}"
              placeholder="0201 / london:0201"
            >

            <button
              class="primary"
              id="jumpBtn"
              type="button"
            >
              ${esc(TEXT.jump)}
            </button>
          </div>
        </div>

        <div class="debug-section">
          <h3>${esc(d("Saved progress", "Mentett haladás"))}</h3>

          <div class="list">
            ${encounterIds
              .map(id => {
                const encounter =
                  GAME.encounters[id];

                const savedPage =
                  save.encounters[id];

                const current =
                  savedPage ||
                  encounter.startPage;

                const timer =
                  save.timers[id];

                const stateText =
                  current === "-1"
                    ? (
                        timer
                          ? d(
                              `waiting → ${timer.resumePage}`,
                              `várakozik → ${timer.resumePage}`
                            )
                          : d(
                              "waiting (timer missing)",
                              "várakozik (timer hiányzik)"
                            )
                      )
                    : (
                        savedPage
                          ? current
                          : d(
                              `${current} (start)`,
                              `${current} (kezdő)`
                            )
                      );

                return `
                  <div
                    class="list-item"
                    style="display:block"
                  >
                    <div
                      style="
                        display:flex;
                        justify-content:space-between;
                        gap:10px;
                        align-items:center;
                        margin-bottom:8px;
                      "
                    >
                      <strong>${esc(id)}</strong>
                      <span>${esc(stateText)}</span>
                    </div>

                    <div
                      style="
                        display:grid;
                        grid-template-columns:1fr 1fr;
                        gap:8px;
                      "
                    >
                      <button
                        class="secondary"
                        type="button"
                        data-debug-open-encounter="${esc(id)}"
                      >
                        ${esc(d("Developer open", "Fejlesztői megnyitás"))}
                      </button>

                      <button
                        class="secondary"
                        type="button"
                        data-debug-reset-encounter="${esc(id)}"
                      >
                        ${esc(d("Reset", "Reset"))}
                      </button>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>

      </section>
    `, {
      back: showDebug
    });

    document
      .querySelectorAll(
        "[data-debug-scan]"
      )
      .forEach(button => {
        button.onclick = () => {
          scannerLocked = false;
          acceptScannedText(button.dataset.debugScan);
        };
      });

    const pageInput = document.getElementById("jumpPage");
    const jumpButton = document.getElementById("jumpBtn");

    const jumpToPage = () => {
      const id = pageInput.value.trim();

      if (!id || !findPage(id)) {
        return toast(TEXT.pageNotFound);
      }

      showPage(id);
    };

    jumpButton.onclick = jumpToPage;
    pageInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        jumpToPage();
      }
    });

    document
      .querySelectorAll(
        "[data-debug-open-encounter]"
      )
      .forEach(button => {
        button.onclick = async () => {
          const id =
            button.dataset
              .debugOpenEncounter;

          const encounter =
            GAME.encounters[id];

          const savedPage =
            save.encounters[id];

          if (savedPage === "-1") {
            return resolveScan(id);
          }

          const pageId =
            savedPage ||
            encounter.startPage;

          if (!findPage(pageId)) {
            return toast(
              TEXT.pageNotFound
            );
          }

          showPage(pageId);
        };
      });

    document
      .querySelectorAll(
        "[data-debug-reset-encounter]"
      )
      .forEach(button => {
        button.onclick = async () => {
          const id =
            button.dataset
              .debugResetEncounter;

          delete save.encounters[id];
          delete save.timers[id];

          if (!await persist()) return;
          showDebugEncounters();
        };
      });
  }


  function showDebugInventory() {
    stopCamera();

    const items = allItemNames();

    if (
      !debugSelectedItem ||
      !items.includes(debugSelectedItem)
    ) {
      debugSelectedItem =
        items[0] || null;
    }

    const selected =
      debugSelectedItem;

    const inInventory =
      selected
        ? save.inventory.includes(selected)
        : false;

    const hadBefore =
      selected
        ? save.hadItems.includes(selected)
        : false;

    const inventoryNames =
      (save.inventory || [])
        .map(getItemDisplayName);

    const hadNames =
      (save.hadItems || [])
        .map(getItemDisplayName);

    shell(`
      <section class="card screen-card">

        <h1 class="screen-title">
          ${esc(d(
            "Inventory & Had Items",
            "Inventory és Had Items"
          ))}
        </h1>

        <p class="screen-subtitle">
          ${esc(d(
            "Inventory means the player has it now. Had Items remembers everything the player has ever owned.",
            "Az Inventory azt jelenti, hogy most nálad van. A Had Items minden valaha megszerzett tárgyat megjegyez."
          ))}
        </p>

        ${
          selected
            ? `
              <div class="debug-section">
                <h3>${esc(d("Choose item", "Tárgy kiválasztása"))}</h3>

                <select
                  id="debugItem"
                  style="width:100%"
                >
                  ${items
                    .map(item => `
                      <option
                        value="${esc(item)}"
                        ${item === selected ? "selected" : ""}
                      >
                        ${esc(getItemDisplayName(item))}
                      </option>
                    `)
                    .join("")}
                </select>

                <div
                  class="notice"
                  style="margin-top:10px"
                >
                  <div>
                    <strong>${esc(d("Internal ID", "Belső ID"))}:</strong>
                    ${esc(selected)}
                  </div>
                  <div style="margin-top:6px">
                    ${esc(d("Inventory", "Inventory"))}:
                    <strong>${inInventory ? "YES" : "NO"}</strong>
                  </div>
                  <div style="margin-top:4px">
                    ${esc(d("Had before", "Volt már nála"))}:
                    <strong>${hadBefore ? "YES" : "NO"}</strong>
                  </div>
                </div>

                <div
                  style="
                    display:grid;
                    grid-template-columns:1fr 1fr;
                    gap:8px;
                    margin-top:10px;
                  "
                >
                  <button
                    class="primary"
                    id="debugAddInventory"
                    type="button"
                  >
                    ${esc(d("Add to inventory", "Inventoryhoz ad"))}
                  </button>

                  <button
                    class="secondary"
                    id="debugRemoveInventory"
                    type="button"
                  >
                    ${esc(d("Remove from inventory", "Inventoryból töröl"))}
                  </button>

                  <button
                    class="primary"
                    id="debugAddHad"
                    type="button"
                  >
                    ${esc(d("Mark as had", "Had Item bekapcsol"))}
                  </button>

                  <button
                    class="secondary"
                    id="debugRemoveHad"
                    type="button"
                  >
                    ${esc(d("Remove had history", "Had Item törlése"))}
                  </button>
                </div>
              </div>
            `
            : `
              <div class="empty">
                ${esc(d("No items found in game data.", "Nem található tárgy a game data-ban."))}
              </div>
            `
        }

        <div class="debug-section">
          <h3>${esc(d("Current state", "Jelenlegi állapot"))}</h3>

          <details>
            <summary>
              ${esc(d("Inventory", "Inventory"))}
              (${inventoryNames.length})
            </summary>
            <div class="notice" style="margin-top:8px">
              ${
                inventoryNames.length
                  ? inventoryNames
                      .map(name => esc(name))
                      .join("<br>")
                  : esc(d("Empty", "Üres"))
              }
            </div>
          </details>

          <details style="margin-top:8px">
            <summary>
              Had Items (${hadNames.length})
            </summary>
            <div class="notice" style="margin-top:8px">
              ${
                hadNames.length
                  ? hadNames
                      .map(name => esc(name))
                      .join("<br>")
                  : esc(d("Empty", "Üres"))
              }
            </div>
          </details>
        </div>

        <div class="debug-section">
          <button
            class="secondary"
            id="clearItemsBtn"
            type="button"
            style="width:100%"
          >
            ${esc(TEXT.clearInventory)}
          </button>

          <button
            class="secondary"
            id="clearHadItemsBtn"
            type="button"
            style="width:100%;margin-top:8px"
          >
            ${esc(d(
              "Clear had-item history",
              "Had-item előzmény törlése"
            ))}
          </button>
        </div>

      </section>
    `, {
      back: showDebug
    });

    const selector =
      document.getElementById("debugItem");

    if (selector) {
      selector.onchange = () => {
        debugSelectedItem =
          selector.value;

        showDebugInventory();
      };
    }

    const addInventory =
      document.getElementById(
        "debugAddInventory"
      );

    if (addInventory) {
      addInventory.onclick = async () => {
        if (
          selected &&
          !save.inventory.includes(selected)
        ) {
          save.inventory.push(selected);
        }

        if (
          selected &&
          !save.hadItems.includes(selected)
        ) {
          save.hadItems.push(selected);
        }

        if (!await persist()) return;
        showDebugInventory();
      };
    }

    const removeInventory =
      document.getElementById(
        "debugRemoveInventory"
      );

    if (removeInventory) {
      removeInventory.onclick = async () => {
        save.inventory =
          save.inventory.filter(
            item => item !== selected
          );

        if (!await persist()) return;
        showDebugInventory();
      };
    }

    const addHad =
      document.getElementById(
        "debugAddHad"
      );

    if (addHad) {
      addHad.onclick = async () => {
        if (
          selected &&
          !save.hadItems.includes(selected)
        ) {
          save.hadItems.push(selected);
        }

        if (!await persist()) return;
        showDebugInventory();
      };
    }

    const removeHad =
      document.getElementById(
        "debugRemoveHad"
      );

    if (removeHad) {
      removeHad.onclick = async () => {
        if (
          save.inventory.includes(selected)
        ) {
          return toast(
            d(
              "Remove the item from inventory first.",
              "Először töröld a tárgyat az inventoryból."
            )
          );
        }

        save.hadItems =
          save.hadItems.filter(
            item => item !== selected
          );

        if (!await persist()) return;
        showDebugInventory();
      };
    }

    document
      .getElementById("clearItemsBtn")
      .onclick = async () => {
        save.inventory = [];
        if (!await persist()) return;
        showDebugInventory();
      };

    document
      .getElementById("clearHadItemsBtn")
      .onclick = async () => {
        save.hadItems = [
          ...save.inventory
        ];

        if (!await persist()) return;
        showDebugInventory();
      };
  }


  function showDebugQuests() {
    stopCamera();

    const quests = allQuestNames();

    if (
      !debugSelectedQuest ||
      !quests.includes(debugSelectedQuest)
    ) {
      debugSelectedQuest =
        quests[0] || null;
    }

    const selected =
      debugSelectedQuest;

    const currentStatus =
      selected
        ? (
            save.quests[selected] ||
            "inactive"
          )
        : "inactive";

    shell(`
      <section class="card screen-card">

        <h1 class="screen-title">
          ${esc(d("Quests", "Küldetések"))}
        </h1>

        <p class="screen-subtitle">
          ${esc(d(
            "Change any quest between inactive, active and completed.",
            "Állíts bármely küldetést inactive, active vagy completed állapotra."
          ))}
        </p>

        ${
          selected
            ? `
              <div class="debug-section">
                <select
                  id="debugQuest"
                  style="width:100%"
                >
                  ${quests
                    .map(quest => `
                      <option
                        value="${esc(quest)}"
                        ${quest === selected ? "selected" : ""}
                      >
                        ${esc(getQuestDisplayName(quest))}
                      </option>
                    `)
                    .join("")}
                </select>

                <div
                  class="debug-row"
                  style="margin-top:10px"
                >
                  <select id="debugQuestStatus">
                    <option
                      value="inactive"
                      ${currentStatus === "inactive" ? "selected" : ""}
                    >
                      inactive
                    </option>
                    <option
                      value="active"
                      ${currentStatus === "active" ? "selected" : ""}
                    >
                      active
                    </option>
                    <option
                      value="completed"
                      ${currentStatus === "completed" ? "selected" : ""}
                    >
                      completed
                    </option>
                  </select>

                  <button
                    class="primary"
                    id="setQuestStatus"
                    type="button"
                  >
                    ${esc(d("Apply", "Alkalmaz"))}
                  </button>
                </div>
              </div>

              <div class="debug-section">
                <h3>${esc(d("All quests", "Összes küldetés"))}</h3>
                <div class="list">
                  ${quests
                    .map(quest => `
                      <div class="list-item">
                        <strong>${esc(getQuestDisplayName(quest))}</strong>
                        <div style="margin-top:4px;opacity:.75">
                          ${esc(save.quests[quest] || "inactive")}
                        </div>
                      </div>
                    `)
                    .join("")}
                </div>
              </div>
            `
            : `
              <div class="empty">
                ${esc(d("No quests found in game data.", "Nem található küldetés a game data-ban."))}
              </div>
            `
        }

      </section>
    `, {
      back: showDebug
    });

    const questSelect =
      document.getElementById("debugQuest");

    if (questSelect) {
      questSelect.onchange = () => {
        debugSelectedQuest =
          questSelect.value;

        showDebugQuests();
      };
    }

    const setButton =
      document.getElementById(
        "setQuestStatus"
      );

    if (setButton) {
      setButton.onclick = async () => {
        const status =
          document
            .getElementById(
              "debugQuestStatus"
            )
            .value;

        if (status === "inactive") {
          delete save.quests[selected];
        } else {
          save.quests[selected] = status;
        }

        if (!await persist()) return;
        showDebugQuests();
      };
    }
  }


  function showDebugKnowledge() {
    stopCamera();

    const ids =
      allKnowledgeIds();

    if (
      !debugSelectedKnowledge ||
      !ids.includes(debugSelectedKnowledge)
    ) {
      debugSelectedKnowledge =
        ids[0] || null;
    }

    const selected =
      debugSelectedKnowledge;

    const selectedData =
      selected &&
      GAME.thingsIKnow
        ? GAME.thingsIKnow[selected]
        : null;

    const known =
      selected
        ? save.knowledge.includes(selected)
        : false;

    shell(`
      <section class="card screen-card">

        <h1 class="screen-title">
          ${esc(d("Things I Know", "Amit tudok"))}
        </h1>

        <p class="screen-subtitle">
          ${esc(d(
            "Add or remove knowledge for testing dialogue conditions.",
            "Adj hozzá vagy törölj tudást a párbeszédfeltételek teszteléséhez."
          ))}
        </p>

        ${
          selected
            ? `
              <div class="debug-section">
                <select
                  id="debugKnowledge"
                  style="width:100%"
                >
                  ${ids
                    .map(id => {
                      const entry =
                        GAME.thingsIKnow &&
                        GAME.thingsIKnow[id];

                      const label =
                        entry &&
                        entry.text
                          ? entry.text
                          : id;

                      return `
                        <option
                          value="${esc(id)}"
                          ${id === selected ? "selected" : ""}
                        >
                          ${esc(label)}
                        </option>
                      `;
                    })
                    .join("")}
                </select>

                <div
                  class="notice"
                  style="margin-top:10px"
                >
                  <div>
                    <strong>${esc(d("Internal ID", "Belső ID"))}:</strong>
                    ${esc(selected)}
                  </div>
                  <div style="margin-top:6px">
                    ${esc(d("Known", "Ismert"))}:
                    <strong>${known ? "YES" : "NO"}</strong>
                  </div>
                  ${
                    selectedData &&
                    selectedData.text
                      ? `
                        <div style="margin-top:6px">
                          ${esc(selectedData.text)}
                        </div>
                      `
                      : ""
                  }
                </div>

                <div
                  style="
                    display:grid;
                    grid-template-columns:1fr 1fr;
                    gap:8px;
                    margin-top:10px;
                  "
                >
                  <button
                    class="primary"
                    id="debugAddKnowledge"
                    type="button"
                  >
                    ${esc(d("Add knowledge", "Tudás hozzáadása"))}
                  </button>

                  <button
                    class="secondary"
                    id="debugRemoveKnowledge"
                    type="button"
                  >
                    ${esc(d("Remove knowledge", "Tudás törlése"))}
                  </button>
                </div>
              </div>
            `
            : `
              <div class="empty">
                ${esc(d(
                  "No knowledge entries found in game data.",
                  "Nem található tudásbejegyzés a game data-ban."
                ))}
              </div>
            `
        }

      </section>
    `, {
      back: showDebug
    });

    const select =
      document.getElementById(
        "debugKnowledge"
      );

    if (select) {
      select.onchange = () => {
        debugSelectedKnowledge =
          select.value;

        showDebugKnowledge();
      };
    }

    const add =
      document.getElementById(
        "debugAddKnowledge"
      );

    if (add) {
      add.onclick = async () => {
        if (
          selected &&
          !save.knowledge.includes(selected)
        ) {
          save.knowledge.push(selected);
        }

        if (!await persist()) return;
        showDebugKnowledge();
      };
    }

    const remove =
      document.getElementById(
        "debugRemoveKnowledge"
      );

    if (remove) {
      remove.onclick = async () => {
        save.knowledge =
          save.knowledge.filter(
            id => id !== selected
          );

        if (!await persist()) return;
        showDebugKnowledge();
      };
    }
  }


  function showDebugCounters() {
    stopCamera();

    const counters =
      allCounterDefinitions();

    const keys =
      counters.map(counter => counter.key);

    if (
      !debugSelectedCounter ||
      !keys.includes(debugSelectedCounter)
    ) {
      debugSelectedCounter =
        keys[0] || null;
    }

    const selected =
      counters.find(
        counter =>
          counter.key ===
          debugSelectedCounter
      ) || null;

    const currentValue =
      selected
        ? Number(
            save.itemState.counters[
              selected.key
            ] || 0
          )
        : 0;

    shell(`
      <section class="card screen-card">

        <h1 class="screen-title">
          ${esc(d("Counters", "Számlálók"))}
        </h1>

        <p class="screen-subtitle">
          ${esc(d(
            "Edit counter values directly without replaying the interaction.",
            "Szerkeszd közvetlenül a counter értékeket az interakció újrajátszása nélkül."
          ))}
        </p>

        ${
          selected
            ? `
              <div class="debug-section">
                <select
                  id="debugCounter"
                  style="width:100%"
                >
                  ${counters
                    .map(counter => `
                      <option
                        value="${esc(counter.key)}"
                        ${counter.key === selected.key ? "selected" : ""}
                      >
                        ${esc(getItemDisplayName(counter.itemName))}
                        —
                        ${esc(counter.counterName)}
                      </option>
                    `)
                    .join("")}
                </select>

                <div
                  class="notice"
                  style="margin-top:10px"
                >
                  <div>
                    <strong>${esc(d("Key", "Kulcs"))}:</strong>
                    ${esc(selected.key)}
                  </div>
                </div>

                <div
                  class="debug-row"
                  style="margin-top:10px"
                >
                  <input
                    class="code-input"
                    id="debugCounterValue"
                    type="number"
                    step="1"
                    value="${esc(currentValue)}"
                  >

                  <button
                    class="primary"
                    id="setCounterBtn"
                    type="button"
                  >
                    ${esc(d("Set", "Beállít"))}
                  </button>
                </div>

                <div
                  style="
                    display:grid;
                    grid-template-columns:repeat(3,1fr);
                    gap:8px;
                    margin-top:8px;
                  "
                >
                  <button
                    class="secondary"
                    id="counterMinus"
                    type="button"
                  >
                    −1
                  </button>

                  <button
                    class="secondary"
                    id="counterPlus"
                    type="button"
                  >
                    +1
                  </button>

                  <button
                    class="secondary"
                    id="counterReset"
                    type="button"
                  >
                    ${esc(d("Reset", "Reset"))}
                  </button>
                </div>
              </div>

              <div class="debug-section">
                <h3>${esc(d("Known counters", "Ismert counterek"))}</h3>
                <div class="list">
                  ${counters
                    .map(counter => `
                      <div class="list-item">
                        ${esc(getItemDisplayName(counter.itemName))}
                        —
                        ${esc(counter.counterName)}
                        <strong style="float:right">
                          ${esc(
                            Number(
                              save.itemState.counters[
                                counter.key
                              ] || 0
                            )
                          )}
                        </strong>
                      </div>
                    `)
                    .join("")}
                </div>
              </div>
            `
            : `
              <div class="empty">
                ${esc(d("No counters found.", "Nem található counter."))}
              </div>
            `
        }

      </section>
    `, {
      back: showDebug
    });

    const counterSelect =
      document.getElementById(
        "debugCounter"
      );

    if (counterSelect) {
      counterSelect.onchange = () => {
        debugSelectedCounter =
          counterSelect.value;

        showDebugCounters();
      };
    }

    const setCounter = async value => {
      if (!selected) {
        return;
      }

      const number = Number(value);

      if (!Number.isFinite(number)) {
        return toast(
          d(
            "Counter value must be a number.",
            "A counter értékének számnak kell lennie."
          )
        );
      }

      save.itemState.counters[
        selected.key
      ] = number;

      if (!await persist()) return;
      showDebugCounters();
    };

    const setButton =
      document.getElementById(
        "setCounterBtn"
      );

    if (setButton) {
      setButton.onclick = () =>
        setCounter(
          document
            .getElementById(
              "debugCounterValue"
            )
            .value
        );
    }

    const minusButton =
      document.getElementById(
        "counterMinus"
      );

    if (minusButton) {
      minusButton.onclick = () =>
        setCounter(currentValue - 1);
    }

    const plusButton =
      document.getElementById(
        "counterPlus"
      );

    if (plusButton) {
      plusButton.onclick = () =>
        setCounter(currentValue + 1);
    }

    const resetButton =
      document.getElementById(
        "counterReset"
      );

    if (resetButton) {
      resetButton.onclick = () =>
        setCounter(0);
    }
  }


  function showDebugFlags() {
    stopCamera();

    const areas = allAreaNames();

    shell(`
      <section class="card screen-card">

        <h1 class="screen-title">
          ${esc(d("Areas & Flags", "Területek és flagek"))}
        </h1>

        <p class="screen-subtitle">
          ${esc(d(
            "Toggle global flags and unlocked areas.",
            "Kapcsold a globális flageket és a feloldott területeket."
          ))}
        </p>

        <div class="debug-section">
          <h3>${esc(d("Global flags", "Globális flagek"))}</h3>

          <div class="list-item" style="display:block">
            <div
              style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:10px;
              "
            >
              <span>castleOpen</span>
              <strong>
                ${save.flags.castleOpen ? "TRUE" : "FALSE"}
              </strong>
            </div>

            <button
              class="secondary"
              id="toggleCastleOpen"
              type="button"
              style="width:100%;margin-top:8px"
            >
              ${esc(d("Toggle", "Átkapcsol"))}
            </button>
          </div>
        </div>

        <div class="debug-section">
          <h3>${esc(d("Unlocked areas", "Feloldott területek"))}</h3>

          ${
            areas.length
              ? `
                <div class="list">
                  ${areas
                    .map(area => {
                      const unlocked =
                        save.flags.unlockedAreas
                          .includes(area);

                      return `
                        <div
                          class="list-item"
                          style="display:block"
                        >
                          <div
                            style="
                              display:flex;
                              justify-content:space-between;
                              gap:10px;
                              align-items:center;
                            "
                          >
                            <span>${esc(area)}</span>
                            <strong>
                              ${unlocked ? "UNLOCKED" : "LOCKED"}
                            </strong>
                          </div>

                          <button
                            class="secondary"
                            type="button"
                            data-debug-area="${esc(area)}"
                            style="width:100%;margin-top:8px"
                          >
                            ${esc(d("Toggle", "Átkapcsol"))}
                          </button>
                        </div>
                      `;
                    })
                    .join("")}
                </div>
              `
              : `
                <div class="empty">
                  ${esc(d("No areas found.", "Nem található terület."))}
                </div>
              `
          }
        </div>

      </section>
    `, {
      back: showDebug
    });

    document
      .getElementById("toggleCastleOpen")
      .onclick = async () => {
        save.flags.castleOpen =
          !save.flags.castleOpen;

        if (!await persist()) return;
        showDebugFlags();
      };

    document
      .querySelectorAll(
        "[data-debug-area]"
      )
      .forEach(button => {
        button.onclick = async () => {
          const area =
            button.dataset.debugArea;

          if (
            save.flags.unlockedAreas
              .includes(area)
          ) {
            save.flags.unlockedAreas =
              save.flags.unlockedAreas
                .filter(
                  value => value !== area
                );
          } else {
            save.flags.unlockedAreas
              .push(area);
          }

          if (!await persist()) return;
          showDebugFlags();
        };
      });
  }


  function debugFormatDuration(ms) {
    const seconds = Math.ceil(ms / 1000);

    if (seconds <= 0) {
      return d("expired", "lejárt");
    }

    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}m ${remainingSeconds}s`;
  }


  function showDebugTimers() {
    stopCamera();

    const timers =
      Object.entries(save.timers || {})
        .sort(([a], [b]) =>
          a.localeCompare(b)
        );

    shell(`
      <section class="card screen-card">

        <h1 class="screen-title">
          ${esc(d("Timers", "Időzítők"))}
        </h1>

        <p class="screen-subtitle">
          ${esc(d(
            "Expire timers instantly or delete them. Deleting a waiting timer also resets that encounter's waiting state.",
            "Járasd le azonnal vagy töröld az időzítőket. Egy várakozó timer törlése az encounter várakozó állapotát is reseteli."
          ))}
        </p>

        ${
          timers.length
            ? `
              <div class="list">
                ${timers
                  .map(([id, timer]) => `
                    <div
                      class="list-item"
                      style="display:block"
                    >
                      <div
                        style="
                          display:flex;
                          justify-content:space-between;
                          gap:10px;
                          align-items:center;
                        "
                      >
                        <strong>${esc(id)}</strong>
                        <span>
                          ${esc(
                            debugFormatDuration(
                              Number(timer.endAt) -
                              Date.now()
                            )
                          )}
                        </span>
                      </div>

                      <div style="margin-top:5px;opacity:.75">
                        ${esc(d("Resume page", "Folytatás oldala"))}:
                        ${esc(timer.resumePage)}
                      </div>

                      <div
                        style="
                          display:grid;
                          grid-template-columns:1fr 1fr;
                          gap:8px;
                          margin-top:8px;
                        "
                      >
                        <button
                          class="secondary"
                          type="button"
                          data-debug-expire-timer="${esc(id)}"
                        >
                          ${esc(d("Expire", "Lejárat"))}
                        </button>

                        <button
                          class="danger"
                          type="button"
                          data-debug-delete-timer="${esc(id)}"
                        >
                          ${esc(d("Delete", "Törlés"))}
                        </button>
                      </div>
                    </div>
                  `)
                  .join("")}
              </div>
            `
            : `
              <div class="empty">
                ${esc(d("No active timers.", "Nincs aktív időzítő."))}
              </div>
            `
        }

        <div class="debug-section">
          <button
            class="secondary"
            id="expireTimers"
            type="button"
            style="width:100%"
          >
            ${esc(TEXT.expireAllTimers)}
          </button>
        </div>

      </section>
    `, {
      back: showDebug
    });

    document
      .querySelectorAll(
        "[data-debug-expire-timer]"
      )
      .forEach(button => {
        button.onclick = async () => {
          const id =
            button.dataset
              .debugExpireTimer;

          if (save.timers[id]) {
            save.timers[id].endAt =
              Date.now() - 1;
          }

          if (!await persist()) return;
          showDebugTimers();
        };
      });

    document
      .querySelectorAll(
        "[data-debug-delete-timer]"
      )
      .forEach(button => {
        button.onclick = async () => {
          const id =
            button.dataset
              .debugDeleteTimer;

          delete save.timers[id];

          if (
            save.encounters[id] === "-1"
          ) {
            delete save.encounters[id];
          }

          if (!await persist()) return;
          showDebugTimers();
        };
      });

    document
      .getElementById("expireTimers")
      .onclick = async () => {
        Object.values(save.timers)
          .forEach(timer => {
            timer.endAt =
              Date.now() - 1;
          });

        if (!await persist()) return;
        showDebugTimers();
      };
  }


  function showDebugSaveTools() {
    stopCamera();

    shell(`
      <section class="card screen-card">

        <h1 class="screen-title">
          ${esc(d("Save Tools", "Mentés eszközök"))}
        </h1>

        <p class="screen-subtitle">
          ${esc(d(
            "Inspect the full save or reset test data.",
            "Nézd meg a teljes mentést vagy reseteld a tesztadatokat."
          ))}
        </p>

        <div class="debug-section">
          <button
            class="secondary"
            id="copySaveJson"
            type="button"
            style="width:100%"
          >
            ${esc(d("Copy save JSON", "Save JSON másolása"))}
          </button>
        </div>

        <div class="debug-section">
          <details>
            <summary>
              ${esc(TEXT.currentSave)}
            </summary>

            <pre
              class="state"
              style="margin-top:10px"
            >${esc(
              JSON.stringify(
                save,
                null,
                2
              )
            )}</pre>
          </details>
        </div>

        <div class="debug-section">
          <button
            class="secondary"
            id="clearItemsSaveBtn"
            type="button"
            style="width:100%"
          >
            ${esc(TEXT.clearInventory)}
          </button>

          <button
            class="danger"
            id="resetSave"
            type="button"
            style="width:100%;margin-top:8px"
          >
            ${esc(TEXT.resetSave)}
          </button>
        </div>

      </section>
    `, {
      back: showDebug
    });

    document
      .getElementById("copySaveJson")
      .onclick = async () => {
        const text =
          JSON.stringify(
            save,
            null,
            2
          );

        try {
          await navigator.clipboard
            .writeText(text);

          toast(
            d(
              "Save JSON copied.",
              "Save JSON kimásolva."
            )
          );
        } catch (_) {
          toast(
            d(
              "Could not copy automatically.",
              "Nem sikerült automatikusan másolni."
            )
          );
        }
      };

    document
      .getElementById("clearItemsSaveBtn")
      .onclick = async () => {
        save.inventory = [];
        if (!await persist()) return;
        showDebugSaveTools();
      };

    document
      .getElementById("resetSave")
      .onclick = async () => {
        if (
          !confirm(
            TEXT.resetProgressQuestion
          )
        ) {
          return;
        }

        save = session.fresh();

        debugSelectedItem = null;
        debugSelectedQuest = null;
        debugSelectedCounter = null;

        if (!await persist()) return;

        toast(
          TEXT.allProgressReset
        );

        showHome();
      };
  }


  // =========================================================
  // OFFLINE

  // =========================================================

  async function registerOffline() {
    if (
      !(
        "serviceWorker"
        in navigator
      ) ||
      ![
        "http:",
        "https:"
      ].includes(
        location.protocol
      )
    ) {
      return;
    }

    try {
      await navigator
        .serviceWorker
        .register("./sw.js?v=43");

      await navigator
        .serviceWorker
        .ready;

      offlineStatus =
        TEXT.readyForOfflinePlay;

      if (
        document.querySelector(
          ".status-line"
        )
      ) {
        showHome();
      }

    } catch (_) {
      offlineStatus =
        TEXT.onlineMode;
    }
  }


  // =========================================================
  // EVENTS / START
  // =========================================================

  for (const eventName of ["click", "submit", "change"]) {
    app.addEventListener(eventName, event => {
      if (!uiBusy) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  document.addEventListener(
    "keydown",
    event => {
      if (
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.key.length !== 1
      ) {
        return;
      }

      const target = event.target;

      if (
        target &&
        (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable
        )
      ) {
        return;
      }

      debugSecretBuffer =
        (
          debugSecretBuffer +
          event.key.toUpperCase()
        ).slice(
          -DEBUG_SECRET.length
        );

      if (
        debugSecretBuffer ===
        DEBUG_SECRET
      ) {
        debugSecretBuffer = "";
        toggleSecretDebugVisibility();
      }
    }
  );


  window.addEventListener(
    "pagehide",
    event => {
      stopCamera();
      if (!event.persisted) {
        disposeScreen?.();
        window.QRCQ_ACTIVE_ASSETS?.dispose();
        for (const url of Object.values(window.QRCQ_MOD_IMAGES || {})) URL.revokeObjectURL(url);
      }
    }
  );


  document.addEventListener(
    "visibilitychange",
    () => {

      if (
        document.hidden &&
        cameraStream
      ) {
        stopCamera();

      } else if (
        !document.hidden &&
        document.getElementById(
          "cameraVideo"
        ) &&
        !cameraStream
      ) {
        scannerLocked =
          false;

        startCameraScanner();
      }
    }
  );


  if (save.completed) showAdventureVictory();
  else showHome();
  registerOffline();

})();
