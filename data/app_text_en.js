window.QR_CITY_QUEST_APP_TEXT = {

  // =========================================================
  // GENERAL
  // =========================================================

  appName: "CITY QUEST",
  homeTitle: "City Quest",

  back: "← Back",
  home: "Home",
  ok: "OK",
  confirm: "Confirm",
  debug: "Debug",

  encounterFallback: "Encounter",


  // =========================================================
  // STARTUP / OFFLINE
  // =========================================================

  localFilesReady: "Local files ready",
  preparingOfflineMode: "Preparing offline mode…",
  readyForOfflinePlay: "✓ Ready for offline play",
  onlineMode: "Online mode",

  gameDataCouldNotLoad:
    "Game data could not be loaded.",


  // =========================================================
  // HOME SCREEN
  // =========================================================

  scanQR: "Scan QR",
  objectives: "Objectives",
  inventory: "Inventory",
  other: "Other",

  notImplementedYet:
    "Not implemented yet.",


  // =========================================================
  // AREA LOCKED
  // =========================================================

  areaLockedTitle:
    "Area Locked",

  areaLockedText:
    "You can't reach this place yet. The bridge is locked.",


  // =========================================================
  // INVENTORY
  // =========================================================

  noItemsYet:
    "You have no items yet.",

  noItems:
    "You have no items.",

  itemHasNoDialogue:
    "This item has no dialogue yet.",

  itemAddedToInventory: itemName =>
    `${itemName} added to inventory.`,


  // =========================================================
  // OBJECTIVES
  // =========================================================

  noActiveObjectives:
    "No active objectives.",

  objectivesTitle:
    "Objectives",

  objectivesSubtitle:
    "Only active quests appear here.",


  // =========================================================
  // QR SCANNER
  // =========================================================

  qrCameraPreview:
    "QR camera preview",

  cameraRequiresHttps:
    "Camera scanning requires HTTPS.",

  cameraUnavailable:
    "Camera access is not available on this device or browser.",

  qrScannerCouldNotLoad:
    "QR scanner could not load. Check your internet connection and reload once.",

  cameraPermissionDenied:
    "Camera permission was denied. Allow camera access, then open Scan QR again.",

  noCameraFound:
    "No camera was found on this device.",

  cameraCouldNotStart:
    "Camera could not start. Reload the page and try again.",


  // =========================================================
  // UNKNOWN QR
  // =========================================================

  unknownQRTitle:
    "Unknown QR",

  unknownQRText:
    "This QR isn't part of this game.",

  scanAgain:
    "Scan again",


  // =========================================================
  // DROPDOWNS
  // =========================================================

  chooseOption:
    "Choose an option",

  choosePlaceholder:
    "Choose…",

  chooseOptionFirst:
    "Choose an option first.",

  noChoicesAvailable:
    "No choices are available on this page.",


  // =========================================================
  // TIMER
  // =========================================================

  waiting:
    "Waiting",

  timerNothingToDo:
    "You can do nothing here.",

  bye:
    "Bye",

  progressSavedTimer:
    "Progress saved. Come back after the timer.",


  // =========================================================
  // WIN SCREEN
  // =========================================================

  youWon:
    "YOU WON",

  demoComplete:
    "The QR City Quest demo is complete.",


  // =========================================================
  // NORMAL ERROR SCREEN
  // =========================================================

  somethingWentWrong:
    "Something went wrong",

  encounterDataProblem:
    "There is a problem with this encounter's game data.",

  saveCouldNotBeWritten:
    "Save could not be written on this browser.",


  // =========================================================
  // DYNAMIC DATA ERRORS
  // These are mostly visible in DEBUG mode.
  // =========================================================

  encounterWaitingWithoutTimer: encounterId =>
    `Encounter ${encounterId} is waiting (-1), but it has no timer record.`,

  timerMissingPage: (encounterId, resumePage) =>
    `Timer for encounter ${encounterId} points to missing page ${resumePage}.`,

  pageDoesNotExist: pageId =>
    `Page ${pageId} does not exist.`,

  noDropdownDestination: pageId =>
    `No dropdown destination exists on ${pageId}.`,

  buttonHasNoDestination: (buttonIndex, pageId) =>
    `Button ${buttonIndex} on page ${pageId} has no destination.`,

  timerOnlyForEncounter: pageId =>
    `Timer on ${pageId} can only be used by a QR encounter.`,

  timerNeedsResumePage: pageId =>
    `Timer on ${pageId} needs a real resume PageID.`,

  unknownAction: (actionType, pageId) =>
    `Unknown action ${actionType} on ${pageId}.`,

  nextScanOnlyForEncounter: pageId =>
    `NEXT_SCAN on ${pageId} can only be used by a QR encounter.`,

  nextScanInvalidPage: (pageId, destination) =>
    `NEXT_SCAN on ${pageId} points to invalid page ${destination}.`,

  unknownDestination: destination =>
    `Unknown destination ${destination}.`,


  // =========================================================
  // DEBUG SCREEN
  // =========================================================

  debugTools:
    "Debug tools",

  debugSubtitle:
    "Development-only helpers from the build specification.",

  jumpToPageId:
    "Jump to PageID",

  jump:
    "Jump",

  inventoryEditor:
    "Inventory editor",

  add:
    "Add",

  clearInventory:
    "Clear inventory",

  expireAllTimers:
    "Expire all timers now",

  resetSave:
    "Reset save",

  currentSave:
    "Current save",

  pageNotFound:
    "Page not found.",

  resetProgressQuestion:
    "Reset all QR City Quest progress on this device?",

  allProgressReset:
    "All progress reset."
};
