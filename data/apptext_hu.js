window.QR_CITY_QUEST_APP_TEXT = {

  // GENERAL
  appName: "CITY QUEST",
  homeTitle: "City Quest",

  back: "← Vissza",
  home: "Főmenü",
  ok: "OK",
  confirm: "Megerősítés",
  debug: "Debug",

  encounterFallback: "Találkozás",


  // STARTUP / OFFLINE
  localFilesReady: "Helyi fájlok készen állnak",
  preparingOfflineMode: "Offline mód előkészítése…",
  readyForOfflinePlay: "✓ Offline játékra kész",
  onlineMode: "Online mód",

  gameDataCouldNotLoad:
    "A játék adatait nem sikerült betölteni.",


  // HOME
  scanQR: "QR-kód beolvasása",
  objectives: "Feladatok",
  inventory: "Tárgyak",
  other: "Egyéb",

  notImplementedYet:
    "Ez még nincs elkészítve.",


  // AREA LOCK
  areaLockedTitle:
    "Lezárt terület",

  areaLockedText:
    "Ezt a helyet még nem érheted el. A híd le van zárva.",


  // INVENTORY
  noItemsYet:
    "Még nincs egyetlen tárgyad sem.",

  noItems:
    "Nincsenek tárgyaid.",

  itemHasNoDialogue:
    "Ehhez a tárgyhoz még nincs párbeszéd.",

  itemAddedToInventory: itemName =>
    `${itemName} bekerült a tárgyaid közé.`,


  // OBJECTIVES
  noActiveObjectives:
    "Nincsenek aktív feladataid.",

  objectivesTitle:
    "Feladatok",

  objectivesSubtitle:
    "Itt csak az aktív küldetések jelennek meg.",


  // QR SCANNER
  qrCameraPreview:
    "QR-kód kamera előnézet",

  cameraRequiresHttps:
    "A kamerás QR-beolvasáshoz HTTPS szükséges.",

  cameraUnavailable:
    "A kamera nem érhető el ezen az eszközön vagy böngészőben.",

  qrScannerCouldNotLoad:
    "A QR-olvasót nem sikerült betölteni. Ellenőrizd az internetkapcsolatot, majd töltsd újra az oldalt.",

  cameraPermissionDenied:
    "A kameraengedély megtagadva. Engedélyezd a kamerát, majd nyisd meg újra a QR-beolvasót.",

  noCameraFound:
    "Nem található kamera ezen az eszközön.",

  cameraCouldNotStart:
    "A kamerát nem sikerült elindítani. Töltsd újra az oldalt, majd próbáld újra.",


  // UNKNOWN QR
  unknownQRTitle:
    "Ismeretlen QR-kód",

  unknownQRText:
    "Ez a QR-kód nem része ennek a játéknak.",

  scanAgain:
    "Újra beolvasás",


  // DROPDOWNS
  chooseOption:
    "Válassz egy lehetőséget",

  choosePlaceholder:
    "Válassz…",

  chooseOptionFirst:
    "Először válassz egy lehetőséget.",

  noChoicesAvailable:
    "Ezen az oldalon nincs választható lehetőség.",


  // TIMER
  waiting:
    "Várakozás",

  timerNothingToDo:
    "Itt most nem tudsz semmit tenni.",

  bye:
    "Viszlát",

  progressSavedTimer:
    "A haladás elmentve. Gyere vissza, amikor lejárt az idő.",

  timerDebugLabel: mins =>
    `IDŐZÍTŐ · ${mins} perc`,


  // WIN
  youWon:
    "NYERTÉL",

  demoComplete:
    "A QR City Quest demója véget ért.",


  // ERRORS
  somethingWentWrong:
    "Valami hiba történt",

  encounterDataProblem:
    "Hiba van ennek a találkozásnak a játékadataiban.",

  saveCouldNotBeWritten:
    "A mentést nem sikerült elmenteni ebben a böngészőben.",


  // DATA ERRORS
  encounterWaitingWithoutTimer: encounterId =>
    `A(z) ${encounterId} találkozás várakozó állapotban van (-1), de nincs hozzá időzítő.`,

  timerMissingPage: (encounterId, resumePage) =>
    `A(z) ${encounterId} találkozás időzítője egy nem létező oldalra mutat: ${resumePage}.`,

  pageDoesNotExist: pageId =>
    `A(z) ${pageId} oldal nem létezik.`,

  noDropdownDestination: pageId =>
    `A(z) ${pageId} oldalon nincs céloldal megadva a lenyíló választáshoz.`,

  buttonHasNoDestination: (buttonIndex, pageId) =>
    `A(z) ${buttonIndex}. gombnak nincs céloldala a(z) ${pageId} oldalon.`,

  timerOnlyForEncounter: pageId =>
    `A(z) ${pageId} oldalon az időzítő csak QR-találkozásnál használható.`,

  timerNeedsResumePage: pageId =>
    `A(z) ${pageId} oldalon az időzítőnek érvényes folytatási PageID-ra van szüksége.`,

  unknownAction: (actionType, pageId) =>
    `Ismeretlen művelet: ${actionType}, oldal: ${pageId}.`,

  nextScanOnlyForEncounter: pageId =>
    `A NEXT_SCAN a(z) ${pageId} oldalon csak QR-találkozásnál használható.`,

  nextScanInvalidPage: (pageId, destination) =>
    `A NEXT_SCAN a(z) ${pageId} oldalon érvénytelen oldalra mutat: ${destination}.`,

  unknownDestination: destination =>
    `Ismeretlen cél: ${destination}.`,


  // COUNTERS
  counterActionNeedsItem: actionType =>
    `A ${actionType} művelethez meg kell adni egy tárgyat, amelyhez a számláló tartozik.`,

  counterActionNeedsName: actionType =>
    `A ${actionType} művelethez meg kell adni a számláló nevét.`,

  counterActionInvalidNumber: actionType =>
    `A ${actionType} műveletben érvénytelen szám szerepel.`,


  // DEBUG
  debugTools:
    "Debug eszközök",

  debugSubtitle:
    "Fejlesztéshez használható segédeszközök.",

  jumpToPageId:
    "Ugrás PageID-ra",

  jump:
    "Ugrás",

  inventoryEditor:
    "Tárgylista szerkesztése",

  add:
    "Hozzáadás",

  clearInventory:
    "Tárgyak törlése",

  expireAllTimers:
    "Összes időzítő lejártatása",

  resetSave:
    "Mentés törlése",

  currentSave:
    "Jelenlegi mentés",

  pageNotFound:
    "Az oldal nem található.",

  resetProgressQuestion:
    "Biztosan törlöd az összes QR City Quest mentést ezen az eszközön?",

  allProgressReset:
    "Minden haladás törölve."
};
