(() => {
  "use strict";

  const LANGUAGE_KEY = "qr-city-quest-language-v1";
  const SUPPORTED_LANGUAGES = ["en", "hu"];
  const app = document.getElementById("app");

  function normalizeLanguage(value) {
    const lang = String(value || "").toLowerCase().trim();
    return SUPPORTED_LANGUAGES.includes(lang) ? lang : null;
  }

  function getSavedLanguage() {
    try {
      return normalizeLanguage(localStorage.getItem(LANGUAGE_KEY));
    } catch (_) {
      return null;
    }
  }

  function saveLanguage(language) {
    const lang = normalizeLanguage(language);
    if (!lang) return;

    try {
      localStorage.setItem(LANGUAGE_KEY, lang);
    } catch (_) {}
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
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.body.appendChild(script);
    });
  }

  function showLanguagePicker() {
    document.documentElement.lang = "en";

    app.innerHTML = `
      <main class="shell">
        <section class="card screen-card encounter-card">
          <div class="speaker-row">
            <div class="speaker">Language / Nyelv</div>
          </div>

          <p class="dialogue">
            Choose your language / Válaszd ki a nyelvet
          </p>

          <div class="choices">
            <button class="choice-btn" id="chooseEnglish" type="button">
              English
            </button>

            <button class="choice-btn" id="chooseHungarian" type="button">
              Magyar
            </button>
          </div>
        </section>
      </main>
    `;

    document.getElementById("chooseEnglish").onclick = () => {
      saveLanguage("en");
      start("en");
    };

    document.getElementById("chooseHungarian").onclick = () => {
      saveLanguage("hu");
      start("hu");
    };
  }

  async function start(language) {
    const lang = normalizeLanguage(language) || "en";

    window.QR_CITY_QUEST_LANGUAGE = lang;
    document.documentElement.lang = lang;

    app.innerHTML = "";

    try {
      await loadScript(`data/apptext_${lang}.js?v=29`);
      await loadScript(`data/game-data_${lang}.js?v=29`);

      // Even a broken installed package must not prevent the core game from starting.
      if (window.QRCQModRuntime) {
        try {
          const mods = await window.QRCQModRuntime.build(window.QR_CITY_QUEST_DATA, lang);
          window.QR_CITY_QUEST_DATA = mods.game;
          window.QRCQ_MOD_IMAGES = mods.images;
          window.QRCQ_MOD_RUNTIME_INFO = { loaded: mods.loaded, errors: mods.errors };
          if (mods.errors.length) console.warn("QR City Quest mod startup:", mods.errors);
        } catch (modError) {
          console.error("Expansion loading failed; starting base game:", modError);
          window.QRCQ_MOD_RUNTIME_INFO = { loaded: [], errors: [String(modError)] };
        }
      }

      await loadScript("app.js?v=29");
    } catch (error) {
      console.error("QR City Quest language loading error:", error);

      app.innerHTML = `
        <main class="shell">
          <section class="card error-card screen-card">
            <div class="error-icon" aria-hidden="true">!</div>
            <h2>Loading error / Betöltési hiba</h2>
            <p>The selected language files could not be loaded.<br>A kiválasztott nyelvi fájlokat nem sikerült betölteni.</p>
          </section>
        </main>
      `;
    }
  }

  const savedLanguage = getSavedLanguage();

  if (savedLanguage) {
    start(savedLanguage);
  } else {
    showLanguagePicker();
  }
})();
