(() => {
  "use strict";

  const LANGUAGE_KEY = "qr-city-quest-language-v1";
  const BUILTIN_LANGUAGES = [
    { code: "en", name: "English", source: "builtin" },
    { code: "hu", name: "Magyar", source: "builtin" }
  ];
  const app = document.getElementById("app");
  let discovery = {
    languages: BUILTIN_LANGUAGES,
    packs: Object.create(null),
    errors: []
  };
  let englishText = null;
  let englishGame = null;

  function normalizeLanguage(value) {
    const lang = String(value || "").toLowerCase().trim();
    return discovery.languages.some(x => x.code === lang) ? lang : null;
  }

  function getSavedLanguage() {
    try { return normalizeLanguage(localStorage.getItem(LANGUAGE_KEY)); }
    catch (_) { return null; }
  }

  function saveLanguage(language) {
    const lang = normalizeLanguage(language);
    if (!lang) return;
    try { localStorage.setItem(LANGUAGE_KEY, lang); } catch (_) {}
  }

  function setLanguage(language) {
    const lang = normalizeLanguage(language);
    if (!lang) return;
    saveLanguage(lang);
    location.reload();
  }
  window.QR_CITY_QUEST_SET_LANGUAGE = setLanguage;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load " + src));
      document.body.appendChild(script);
    });
  }

  const escapeHTML = text => String(text)
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

  function showLanguagePicker() {
    document.documentElement.lang = "en";
    window.QR_CITY_QUEST_LANGUAGE = "en";
    app.innerHTML = `
      <main class="shell">
        <section class="card screen-card encounter-card">
          <div class="speaker-row">
            <div class="speaker">Language / Nyelv</div>
          </div>
          <p class="dialogue">Choose your language / Válaszd ki a nyelvet</p>
          <div class="choices">
            ${discovery.languages.map(({ code, name }) => `
              <button class="choice-btn" type="button"
                data-start-language="${escapeHTML(code)}">
                ${escapeHTML(name)}
              </button>
            `).join("")}
          </div>
        </section>
      </main>
    `;
    app.querySelectorAll("[data-start-language]").forEach(button => {
      button.onclick = () => {
        const lang = normalizeLanguage(button.dataset.startLanguage);
        if (!lang) return;
        saveLanguage(lang);
        start(lang);
      };
    });
  }

  async function start(language) {
    const lang = normalizeLanguage(language) || "en";
    window.QR_CITY_QUEST_LANGUAGE = lang;
    document.documentElement.lang = lang;
    app.innerHTML = "";

    try {
      if (lang === "en") {
        window.QR_CITY_QUEST_APP_TEXT = englishText;
        window.QR_CITY_QUEST_DATA = englishGame;
      } else if (lang === "hu") {
        await loadScript("data/apptext_hu.js?v=30");
        await loadScript("data/game-data_hu.js?v=30");
      } else {
        const pack = discovery.packs[lang];
        if (!pack) throw Error("Selected language pack is not installed");
        // Imported data is parsed as static JSON and never executed.
        window.QR_CITY_QUEST_APP_TEXT =
          window.QRCQModLocalization.makeAppText(englishText, pack.app);
        window.QR_CITY_QUEST_DATA = pack.game;
      }

      if (window.QRCQModRuntime) {
        try {
          const mods = await window.QRCQModRuntime.build(window.QR_CITY_QUEST_DATA, lang);
          window.QR_CITY_QUEST_DATA = mods.game;
          window.QRCQ_MOD_IMAGES = mods.images;
          window.QRCQ_MOD_APP_TEXT = mods.appText || {};
          window.QRCQ_MOD_RUNTIME_INFO = { loaded: mods.loaded, errors: mods.errors };
          if (mods.errors.length) console.warn("QR City Quest mod startup:", mods.errors);
        } catch (modError) {
          console.error("Expansion loading failed; starting base game:", modError);
          window.QRCQ_MOD_RUNTIME_INFO = { loaded: [], errors: [String(modError)] };
        }
      }

      await loadScript("app.js?v=30");
    } catch (error) {
      console.error("QR City Quest language loading error:", error);
      app.innerHTML = `
        <main class="shell">
          <section class="card error-card screen-card">
            <div class="error-icon" aria-hidden="true">!</div>
            <h2>Loading error / Betöltési hiba</h2>
            <p>Could not load the selected language. Refresh the game and try English.</p>
          </section>
        </main>
      `;
    }
  }

  async function initialize() {
    try {
      // Load trusted original English data once to validate independent translations.
      await loadScript("data/apptext_en.js?v=30");
      englishText = window.QR_CITY_QUEST_APP_TEXT;
      await loadScript("data/game-data_en.js?v=30");
      englishGame = window.QR_CITY_QUEST_DATA;

      if (window.QRCQModLocalization && window.QRCQModStorage) {
        try {
          const entries = await window.QRCQModStorage.list();
          discovery = window.QRCQModLocalization.discover(entries, englishGame, englishText);
          if (discovery.errors.length) console.warn("Language pack diagnostics:", discovery.errors);
        } catch (storageError) {
          console.warn("Could not inspect installed language packs:", storageError);
        }
      }
      window.QR_CITY_QUEST_AVAILABLE_LANGUAGES = discovery.languages;

      const saved = getSavedLanguage();
      if (saved) await start(saved);
      else showLanguagePicker();
    } catch (error) {
      console.error("Core game data could not be loaded:", error);
      app.textContent = "QR City Quest could not load its built-in language files.";
    }
  }

  initialize();
})();
