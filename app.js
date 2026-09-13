(() => {
  "use strict";

  const GAME = window.QR_CITY_QUEST_DATA;
  const TEXT = window.QR_CITY_QUEST_APP_TEXT;

  const SAVE_KEY = "qr-city-quest-save-v1";
  const DEBUG = new URLSearchParams(location.search).get("debug") === "1";
  const LANGUAGE = window.QR_CITY_QUEST_LANGUAGE || "en";
  const app = document.getElementById("app");

  // apptext_en.js must be loaded before app.js
  if (!TEXT) {
    console.error("QR City Quest app text could not be loaded.");
    return;
  }

  let save = loadSave();
  let currentEncounter = null;
  let currentItemName = null;
  let currentPageId = null;
  let transitionLocked = false;
  let scannerLocked = false;
  let cameraStream = null;
  let scanLoopToken = 0;
  let zxingControls = null;

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

  function defaultSave() {
    return {
      schemaVersion: 1,
      inventory: [],
      hadItems: [],
      knowledge: [],
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

      if (!raw) {
        return defaultSave();
      }

      const value = JSON.parse(raw);

      if (
        !value ||
        value.schemaVersion !== 1
      ) {
        return defaultSave();
      }

      const clean = defaultSave();

      clean.inventory =
        Array.isArray(value.inventory)
          ? [
              ...new Set(
                value.inventory
                  .filter(
                    x =>
                      typeof x === "string" &&
                      x.trim()
                  )
                  .map(x => x.trim())
              )
            ]
          : [];

      clean.hadItems =
        Array.isArray(value.hadItems)
          ? [
              ...new Set(
                value.hadItems
                  .filter(
                    x =>
                      typeof x === "string" &&
                      x.trim()
                  )
                  .map(x => x.trim())
              )
            ]
          : [...clean.inventory];


      
      for (const item of clean.inventory) {
        if (!clean.hadItems.includes(item)) {
          clean.hadItems.push(item);
        }
      }

      clean.knowledge =
        Array.isArray(value.knowledge)
          ? [
              ...new Set(
                value.knowledge
                  .filter(
                    x =>
                      typeof x === "string" &&
                      x.trim()
                  )
                  .map(x => x.trim())
              )
            ]
          : [];
            
      clean.quests =
        value.quests &&
        typeof value.quests === "object"
          ? value.quests
          : {};

      clean.encounters =
        value.encounters &&
        typeof value.encounters === "object"
          ? value.encounters
          : {};

      clean.timers =
        value.timers &&
        typeof value.timers === "object"
          ? value.timers
          : {};

      clean.flags.castleOpen =
        !!(
          value.flags &&
          value.flags.castleOpen
        );

      clean.flags.unlockedAreas =
        Array.isArray(
          value.flags &&
          value.flags.unlockedAreas
        )
          ? [
              ...new Set(
                value.flags.unlockedAreas.filter(
                  x =>
                    typeof x === "string" &&
                    x.trim()
                )
              )
            ]
          : [];

      const oldItemState =
        value.itemState &&
        typeof value.itemState === "object"
          ? value.itemState
          : {};

      clean.itemState.counters =
        oldItemState.counters &&
        typeof oldItemState.counters === "object"
          ? oldItemState.counters
          : {};

      clean.itemState.usedButtons =
        oldItemState.usedButtons &&
        typeof oldItemState.usedButtons === "object"
          ? oldItemState.usedButtons
          : {};

      clean.itemState.oneTimeRewards =
        oldItemState.oneTimeRewards &&
        typeof oldItemState.oneTimeRewards === "object"
          ? oldItemState.oneTimeRewards
          : {};

      // Migrate old special-mechanics save state
      // into the new generic counter system.
      const legacyCounterMigrations = [
        {
          oldKey: "Fishing Rod::Blobfish",
          newKey: "Fishing Rod::blobfishCaught"
        },
        {
          oldKey: "Fishing Rod::Great Salmon",
          newKey: "Fishing Rod::salmonCaught"
        },
        {
          oldKey: "Fishing Rod::Old Boots",
          newKey: "Fishing Rod::bootsCaught"
        }
      ];

      for (
        const migration
        of legacyCounterMigrations
      ) {
        if (
          clean.itemState
            .oneTimeRewards[
              migration.oldKey
            ] &&
          !Number(
            clean.itemState
              .counters[
                migration.newKey
              ]
          )
        ) {
          clean.itemState
            .counters[
              migration.newKey
            ] = 1;
        }
      }

      if (
        clean.itemState
          .usedButtons[
            "Silver Ring::2601::Put it on."
          ] &&
        !Number(
          clean.itemState
            .counters[
              "Silver Ring::worn"
            ]
        )
      ) {
        clean.itemState
          .counters[
            "Silver Ring::worn"
          ] = 1;
      }

      clean.lastSavedAt =
        Number(value.lastSavedAt) ||
        Date.now();

      return clean;

    } catch (_) {
      return defaultSave();
    }
  }


  function persist() {
    save.inventory = [
      ...new Set(save.inventory)
    ];

    save.hadItems = [
      ...new Set(save.hadItems || [])
    ];

    save.knowledge = [
      ...new Set(save.knowledge || [])
    ];

    for (const item of save.inventory) {
      if (!save.hadItems.includes(item)) {
        save.hadItems.push(item);
      }
    }

    save.flags.unlockedAreas = [
      ...new Set(
        save.flags.unlockedAreas || []
      )
    ];

    save.lastSavedAt = Date.now();

    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify(save)
      );

      if (
        navigator.storage &&
        navigator.storage.persist
      ) {
        navigator.storage
          .persist()
          .catch(() => {});
      }

      return true;

    } catch (_) {
      toast(
        TEXT.saveCouldNotBeWritten
      );

      return false;
    }
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
      debugButton = false
    } = {}
  ) {
    app.innerHTML = `
      <main class="shell">

        <header class="topbar">

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

          <div class="top-actions">
            <button
              class="icon-button"
              id="languageBtn"
              type="button"
              aria-label="${esc(TEXT.switchLanguage)}"
              title="${esc(TEXT.switchLanguage)}"
            >
              ${LANGUAGE === "hu" ? "EN" : "HU"}
            </button>

            ${
              debugButton
                ? `
                  <button
                    class="icon-button"
                    id="debugBtn"
                    type="button"
                  >
                    ${esc(TEXT.debug)}
                  </button>
                `
                : ""
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

    const languageBtn =
      document.getElementById("languageBtn");

    if (languageBtn) {
      languageBtn.onclick = () => {
        const nextLanguage =
          LANGUAGE === "hu"
            ? "en"
            : "hu";

        if (
          typeof window.QR_CITY_QUEST_SET_LANGUAGE ===
          "function"
        ) {
          window.QR_CITY_QUEST_SET_LANGUAGE(
            nextLanguage
          );
        }
      };
    }

    if (debugButton) {
      document
        .getElementById("debugBtn")
        .onclick = showDebug;
    }
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

    shell(`
      <section class="hero">
        <h1>${esc(TEXT.homeTitle)}</h1>
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
              aria-label="${esc(TEXT.objectives)}"
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
    `, {
      debugButton: DEBUG
    });

    document
      .getElementById("scanBtn")
      .onclick = showScanner;

    document
      .getElementById("objectivesBtn")
      .onclick = showObjectives;

    document
      .getElementById("inventoryBtn")
      .onclick = showInventory;

    document
      .getElementById("knowledgeBtn")
      .onclick = showThingsIKnow;
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

      if (
        startPage.slice(0, 2) === qr
      ) {
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

  const items =
    save.inventory.length
      ? `
        <div class="inventory-grid">
          ${
            save.inventory
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

                return `
                  <button
                    class="inventory-item-button"
                    type="button"
                    data-inventory-index="${index}"
                    aria-label="${esc(displayName)}"
                    title="${esc(displayName)}"
                  >
                    ${
                      picture
                        ? `
                          <img
                            class="inventory-item-icon"
                            src="./images/${esc(picture)}.png"
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
          save.inventory[
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
  const item =
    getItemDefinition(itemName);

  if (!item) {
    return toast(
      TEXT.itemHasNoDialogue
    );
  }

  currentItemName = item.name;
  currentEncounter = null;

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
  // QR SCANNER
  // =========================================================

  function showScanner() {
    stopCamera();

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

      </section>
    `, {
      back: showHome
    });

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


  function acceptScannedText(raw) {
    if (scannerLocked) {
      return;
    }

    const qr =
      String(raw ?? "")
        .trim();

    const encounterExists =
      /^\d{2}$/.test(qr) &&
      GAME.encounters &&
      GAME.encounters[qr];

    const item =
      /^\d{2}$/.test(qr)
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
      if (
        !save.inventory.includes(
          item.name
        )
      ) {
        save.inventory.push(
          item.name
        );

        persist();

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
    }
  }


  // =========================================================
  // ENCOUNTERS
  // =========================================================

  function resolveScan(encounterId) {
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

    persist();

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

    const encounterId =
      id.slice(0, 2);

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

    const pictureMarkup =
      picture
        ? `
          <div class="encounter-picture">
            <img
              src="./images/${esc(picture)}.png"
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
    return page.buttons.filter(
      button => {

        if (
          button.condition &&
          !checkButtonCondition(
            button.condition,
            page,
            button,
            context
          )
        ) {
          return false;
        }

        return true;
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
      destination
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

  function handleTransition(
    page,
    buttonIndex,
    destination
  ) {
    if (transitionLocked) {
      return;
    }

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
            !/^\d{4}$/.test(
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

          save.timers[
            context.encounterId
          ] = {
            endAt:
              Date.now() +
              Number(
                action.durationMs
              ),

            resumePage:
              destination
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


        case "NEXT_SCAN":

          if (
            buttonIndex === 1
          ) {
            nextScan =
              true;
          }

          break;


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
      persist();

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
        !/^\d{4}$/.test(
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

      persist();

      return showHome();
    }


    if (mutated) {
      persist();
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
      destination ===
      "TITLE_SCREEN"
    ) {
      return showWin();
    }

    if (
      destination === "-1"
    ) {
      return showHome();
    }

    if (
      !/^\d{4}$/.test(
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

  function showWin() {
    stopCamera();

    shell(`
      <section class="win">

        <div class="win-inner">

          <div
            class="win-crown"
            aria-hidden="true"
          >
            ♛
          </div>

          <h1>
            ${esc(TEXT.youWon)}
          </h1>

          <p>
            ${esc(TEXT.demoComplete)}
          </p>

          ${
            DEBUG
              ? `
                <button
                  class="secondary"
                  id="winHome"
                  type="button"
                >
                  ${esc(TEXT.home)}
                </button>
              `
              : ""
          }

        </div>

      </section>
    `);

    if (DEBUG) {
      document
        .getElementById("winHome")
        .onclick = showHome;
    }
  }


  // =========================================================
  // UNKNOWN QR
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
            action.type === "REMOVE_ITEM"
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

      for (
        const button
        of Array.isArray(page.buttons)
          ? page.buttons
          : []
      ) {
        if (
          typeof button.condition !== "string"
        ) {
          continue;
        }

        const regex =
          /counter\(\s*["']([^"']+)["']\s*(?:,\s*["']([^"']+)["'])?\s*\)/g;

        let match;

        while (
          (
            match = regex.exec(
              button.condition
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
      back: showHome
    });

    const routes = {
      encounters: showDebugEncounters,
      inventory: showDebugInventory,
      quests: showDebugQuests,
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
          <h3>${esc(TEXT.jumpToPageId)}</h3>

          <div class="debug-row">
            <input
              class="code-input"
              id="jumpPage"
              inputmode="numeric"
              maxlength="4"
              placeholder="2301"
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
                        ${esc(d("Open", "Megnyitás"))}
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
        button.onclick = () =>
          resolveScan(
            button.dataset.debugScan
          );
      });

    document
      .getElementById("jumpBtn")
      .onclick = () => {
        const id =
          document
            .getElementById("jumpPage")
            .value
            .trim();

        if (!findPage(id)) {
          return toast(
            TEXT.pageNotFound
          );
        }

        showPage(id);
      };

    document
      .querySelectorAll(
        "[data-debug-open-encounter]"
      )
      .forEach(button => {
        button.onclick = () => {
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
        button.onclick = () => {
          const id =
            button.dataset
              .debugResetEncounter;

          delete save.encounters[id];
          delete save.timers[id];

          persist();
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
      addInventory.onclick = () => {
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

        persist();
        showDebugInventory();
      };
    }

    const removeInventory =
      document.getElementById(
        "debugRemoveInventory"
      );

    if (removeInventory) {
      removeInventory.onclick = () => {
        save.inventory =
          save.inventory.filter(
            item => item !== selected
          );

        persist();
        showDebugInventory();
      };
    }

    const addHad =
      document.getElementById(
        "debugAddHad"
      );

    if (addHad) {
      addHad.onclick = () => {
        if (
          selected &&
          !save.hadItems.includes(selected)
        ) {
          save.hadItems.push(selected);
        }

        persist();
        showDebugInventory();
      };
    }

    const removeHad =
      document.getElementById(
        "debugRemoveHad"
      );

    if (removeHad) {
      removeHad.onclick = () => {
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

        persist();
        showDebugInventory();
      };
    }

    document
      .getElementById("clearItemsBtn")
      .onclick = () => {
        save.inventory = [];
        persist();
        showDebugInventory();
      };

    document
      .getElementById("clearHadItemsBtn")
      .onclick = () => {
        save.hadItems = [
          ...save.inventory
        ];

        persist();
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
      setButton.onclick = () => {
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

        persist();
        showDebugQuests();
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

    const setCounter = value => {
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

      persist();
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
      .onclick = () => {
        save.flags.castleOpen =
          !save.flags.castleOpen;

        persist();
        showDebugFlags();
      };

    document
      .querySelectorAll(
        "[data-debug-area]"
      )
      .forEach(button => {
        button.onclick = () => {
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

          persist();
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
        button.onclick = () => {
          const id =
            button.dataset
              .debugExpireTimer;

          if (save.timers[id]) {
            save.timers[id].endAt =
              Date.now() - 1;
          }

          persist();
          showDebugTimers();
        };
      });

    document
      .querySelectorAll(
        "[data-debug-delete-timer]"
      )
      .forEach(button => {
        button.onclick = () => {
          const id =
            button.dataset
              .debugDeleteTimer;

          delete save.timers[id];

          if (
            save.encounters[id] === "-1"
          ) {
            delete save.encounters[id];
          }

          persist();
          showDebugTimers();
        };
      });

    document
      .getElementById("expireTimers")
      .onclick = () => {
        Object.values(save.timers)
          .forEach(timer => {
            timer.endAt =
              Date.now() - 1;
          });

        persist();
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
      .onclick = () => {
        save.inventory = [];
        persist();
        showDebugSaveTools();
      };

    document
      .getElementById("resetSave")
      .onclick = () => {
        if (
          !confirm(
            TEXT.resetProgressQuestion
          )
        ) {
          return;
        }

        localStorage.removeItem(
          SAVE_KEY
        );

        save = defaultSave();

        debugSelectedItem = null;
        debugSelectedQuest = null;
        debugSelectedCounter = null;

        persist();

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
        .register("./sw.js");

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

  window.addEventListener(
    "pagehide",
    stopCamera
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


  showHome();
  registerOffline();

})();
