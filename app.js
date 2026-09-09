(() => {
  "use strict";

  const GAME = window.QR_CITY_QUEST_DATA;
  const TEXT = window.QR_CITY_QUEST_APP_TEXT;

  const SAVE_KEY = "qr-city-quest-save-v1";
  const DEBUG = new URLSearchParams(location.search).get("debug") === "1";
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
              id="extraBtn"
              type="button"
              aria-label="${esc(TEXT.other)}"
            >
              🧲
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
      .getElementById("extraBtn")
      .onclick = () =>
        toast(
          TEXT.notImplementedYet
        );
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
          <div class="list">

            ${
              save.inventory
                .map(
                  (item, index) => `
                    <button
                      class="list-item"
                      type="button"
                      data-inventory-index="${index}"
                      style="
                        width:100%;
                        text-align:left;
                        color:inherit;
                        font:inherit;
                        cursor:pointer
                      "
                    >
                      ${esc(getItemDisplayName(item))}
                    </button>
                  `
                )
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
                      ◇ ${esc(q)}
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

        <p class="dialogue">
          ${esc(page.text)}
        </p>

        ${controls}

      </section>
    `, {
      back:
        context.type === "item"
          ? showInventory
          : showHome
    });

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

    if (
      !select ||
      !select.value
    ) {
      if (
        action.type ===
          "DROPDOWN_INVENTORY" &&
        save.inventory.length === 0
      ) {
        return toast(
          TEXT.noItems
        );
      }

      return toast(
        TEXT.chooseOptionFirst
      );
    }

    let destination =
      null;

    if (
      action.type ===
      "DROPDOWN_CHOICE"
    ) {
      const match =
        (
          Array.isArray(
            action.options
          )
            ? action.options
            : []
        ).find(
          option =>
            option.label ===
            select.value
        );

      destination =
        match &&
        match.next;

    } else {

      const selectedItem =
        select.value;

      const options =
        Array.isArray(action.options)
          ? action.options
          : [];

      const matchingOption =
        options.find(
          option =>
            option.label !== "Other" &&
            String(
              option.value ??
              option.label ??
              ""
            ) === selectedItem
        );

      if (matchingOption) {
        destination =
          matchingOption.next;

      } else if (action.otherNext) {
        destination =
          action.otherNext;

      } else {
        // Backward compatibility with old game-data files.
        const oldOther =
          options.find(
            option =>
              option.label === "Other"
          );

        destination =
          oldOther &&
          oldOther.next;
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

  function allItemNames() {
    const names =
      new Set(
        save.inventory
      );

    if (GAME.items) {
      Object.keys(
        GAME.items
      ).forEach(
        name =>
          names.add(name)
      );
    }

    for (
      const enc
      of Object.values(
        GAME.encounters
      )
    ) {
      for (
        const page
        of Object.values(
          enc.pages
        )
      ) {
        for (
          const action
          of page.actions
        ) {

          if (
            (
              action.type ===
                "ADD_ITEM" ||
              action.type ===
                "REMOVE_ITEM"
            ) &&
            action.data
          ) {
            names.add(
              action.data
            );
          }

          if (
            action.type ===
            "DROPDOWN_INVENTORY" &&
            Array.isArray(
              action.options
            )
          ) {
            action.options
              .forEach(
                option => {
                  const value =
                    String(
                      option.value ??
                      option.label ??
                      ""
                    );

                  if (
                    value &&
                    value !== "Other"
                  ) {
                    names.add(
                      value
                    );
                  }
                }
              );
          }
        }
      }
    }

    return [
      ...names
    ].sort(
      (a, b) =>
        getItemDisplayName(a)
          .localeCompare(
            getItemDisplayName(b)
          )
    );
  }


  function showDebug() {
    stopCamera();

    const items =
      allItemNames();

    shell(`
      <section class="card screen-card">

        <h1 class="screen-title">
          ${esc(TEXT.debugTools)}
        </h1>

        <p class="screen-subtitle">
          ${esc(TEXT.debugSubtitle)}
        </p>

        <div class="debug-grid">

          ${
            Object.keys(
              GAME.encounters
            )
              .map(
                id => `
                  <button
                    type="button"
                    data-debug-scan="${id}"
                  >
                    ${id}
                  </button>
                `
              )
              .join("")
          }

        </div>


        <div class="debug-section">

          <h3>
            ${esc(TEXT.jumpToPageId)}
          </h3>

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

          <h3>
            ${esc(TEXT.inventoryEditor)}
          </h3>

          <div class="debug-row">

            <select id="debugItem">

              ${
                items
                  .map(
                    i => `
                      <option
                        value="${esc(i)}"
                      >
                        ${esc(
                          getItemDisplayName(i)
                        )}
                      </option>
                    `
                  )
                  .join("")
              }

            </select>

            <button
              class="primary"
              id="addItemBtn"
              type="button"
            >
              ${esc(TEXT.add)}
            </button>

          </div>

          <button
            class="secondary"
            id="clearItemsBtn"
            type="button"
            style="
              width:100%;
              margin-top:8px
            "
          >
            ${esc(TEXT.clearInventory)}
          </button>

        </div>


        <div class="debug-section">

          <button
            class="secondary"
            id="expireTimers"
            type="button"
            style="width:100%"
          >
            ${esc(TEXT.expireAllTimers)}
          </button>

          <button
            class="danger"
            id="resetSave"
            type="button"
            style="
              width:100%;
              margin-top:8px
            "
          >
            ${esc(TEXT.resetSave)}
          </button>

        </div>


        <div class="debug-section">

          <h3>
            ${esc(TEXT.currentSave)}
          </h3>

          <pre class="state">${
            esc(
              JSON.stringify(
                save,
                null,
                2
              )
            )
          }</pre>

        </div>

      </section>
    `, {
      back: showHome
    });


    document
      .querySelectorAll(
        "[data-debug-scan]"
      )
      .forEach(button => {

        button.onclick =
          () =>
            resolveScan(
              button.dataset
                .debugScan
            );

      });


    document
      .getElementById("jumpBtn")
      .onclick = () => {

        const id =
          document
            .getElementById(
              "jumpPage"
            )
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
      .getElementById(
        "addItemBtn"
      )
      .onclick = () => {

        const item =
          document
            .getElementById(
              "debugItem"
            )
            .value;

        if (
          !save.inventory
            .includes(item)
        ) {
          save.inventory.push(
            item
          );

        }

        persist();
        showDebug();
      };


    document
      .getElementById(
        "clearItemsBtn"
      )
      .onclick = () => {

        save.inventory = [];

        persist();
        showDebug();
      };


    document
      .getElementById(
        "expireTimers"
      )
      .onclick = () => {

        Object.values(
          save.timers
        ).forEach(
          timer =>
            timer.endAt =
              Date.now() - 1
        );

        persist();
        showDebug();
      };


    document
      .getElementById(
        "resetSave"
      )
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

        save =
          defaultSave();

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
