#!/usr/bin/env python3
"""Compile QR City Quest CSV authoring data into normalized runtime JSON/JS.

Usage:
  python tools/compile_game_data.py

The input defaults to data/source-snapshot.csv. Replace that CSV with a fresh
export using the same column names, then run this script.
"""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source-snapshot.csv"
OUT_JSON = ROOT / "data" / "game-data.json"
OUT_JS = ROOT / "data" / "game-data.js"

DATA_ACTIONS = {
    "ADD_ITEM", "REMOVE_ITEM", "START_QUEST", "COMPLETE_QUEST",
    "START_TIMER", "DROPDOWN_INVENTORY", "DROPDOWN_CHOICE", "PASSWORD_INPUT",
}
NO_DATA_ACTIONS = {"NEXT_SCAN", "OPEN_CASTLE"}
KNOWN_ACTIONS = DATA_ACTIONS | NO_DATA_ACTIONS
SPECIAL_DESTINATIONS = {"-1", "TITLE_SCREEN"}
REQUIRED_COLUMNS = [
    "PageID", "NPC", "Text",
    "Button1", "Next1", "Button2", "Next2", "Button3", "Next3", "Button4", "Next4",
    "Action", "ActionData", "Condition",
]


def clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def parse_duration(value: str, row_number: int, page_id: str) -> int:
    m = re.fullmatch(r"(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)", value.strip().lower())
    if not m:
        raise ValueError(f"ERROR [row {row_number} / PageID {page_id}] Invalid timer duration: {value}")
    number = float(m.group(1))
    unit = m.group(2)
    factor = 1000 if unit.startswith("s") else 60000 if unit.startswith("m") else 3600000
    return int(number * factor)


def parse_dropdown(value: str, row_number: int, page_id: str) -> list[dict]:
    options = []
    labels = set()
    for raw in value.split(";"):
        raw = raw.strip()
        if not raw:
            continue
        label, sep, destination = raw.rpartition("-")
        label = label.strip()
        destination = destination.strip()
        if not sep or not label or not destination:
            raise ValueError(f"ERROR [row {row_number} / PageID {page_id}] Invalid dropdown entry: {raw}")
        if label in labels:
            raise ValueError(f"ERROR [row {row_number} / PageID {page_id}] Duplicate dropdown label: {label}")
        labels.add(label)
        options.append({"label": label, "next": destination})
    if not options:
        raise ValueError(f"ERROR [row {row_number} / PageID {page_id}] Dropdown has no options")
    return options


def payloads_for(actions: list[str], raw_data: str | None, row_number: int, page_id: str) -> dict[str, str]:
    consumers = [a for a in actions if a in DATA_ACTIONS]
    if not consumers:
        if raw_data:
            raise ValueError(f"ERROR [row {row_number} / PageID {page_id}] ActionData is unused: {raw_data}")
        return {}
    if not raw_data:
        raise ValueError(f"ERROR [row {row_number} / PageID {page_id}] Missing ActionData")
    if len(consumers) == 1:
        return {consumers[0]: raw_data}

    # The build specification documents pipe-separated payload groups, while the
    # current workbook uses semicolons for multi-action payloads. Supporting both
    # keeps the compiler compatible with the authored demo and the documented rule.
    parts = [p.strip() for p in (raw_data.split("|") if "|" in raw_data else raw_data.split(";"))]
    if len(parts) != len(consumers) or any(not p for p in parts):
        raise ValueError(
            f"ERROR [row {row_number} / PageID {page_id}] Expected {len(consumers)} ActionData payloads, got {len(parts)}"
        )
    return dict(zip(consumers, parts))


def compile_data() -> dict:
    with SOURCE.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames != REQUIRED_COLUMNS:
            missing = [c for c in REQUIRED_COLUMNS if c not in (reader.fieldnames or [])]
            if missing:
                raise ValueError(f"Missing required columns: {', '.join(missing)}")
        rows = list(reader)

    game = {
        "formatVersion": 1,
        "generatedFrom": SOURCE.name,
        "encounters": {},
        "compilerNotes": [
            "PASSWORD_INPUT is normalized to DROPDOWN_CHOICE.",
            "Both pipe-separated and semicolon-separated multi-action ActionData payloads are accepted.",
        ],
    }
    warnings: list[str] = []
    all_ids: set[str] = set()

    for row_number, raw in enumerate(rows, start=2):
        row = {key: clean(value) for key, value in raw.items()}
        page_id = row["PageID"] or ""
        if not re.fullmatch(r"\d{4}", page_id):
            raise ValueError(f"ERROR [row {row_number} / PageID {page_id or '?'}] PageID must be four digits")
        if page_id in all_ids:
            raise ValueError(f"ERROR [row {row_number} / PageID {page_id}] Duplicate PageID")
        all_ids.add(page_id)

        buttons = []
        for index in range(1, 5):
            label = row[f"Button{index}"]
            destination = row[f"Next{index}"]
            if label:
                if not destination:
                    raise ValueError(f"ERROR [row {row_number} / PageID {page_id}] Button{index} has no Next{index}")
                buttons.append({"index": index, "label": label, "next": destination})
            elif destination:
                raise ValueError(f"ERROR [row {row_number} / PageID {page_id}] Next{index} exists without Button{index}")

        actions = [x.strip() for x in (row["Action"] or "").split(";") if x.strip()]
        unknown = [a for a in actions if a not in KNOWN_ACTIONS]
        if unknown:
            raise ValueError(f"ERROR [row {row_number} / PageID {page_id}] Unknown Action: {unknown[0]}")

        condition = None
        if row["Condition"]:
            if row["Condition"] != "HAS_ITEM":
                raise ValueError(f"ERROR [row {row_number} / PageID {page_id}] Unknown Condition: {row['Condition']}")
            if any(a in DATA_ACTIONS for a in actions):
                raise ValueError(f"ERROR [row {row_number} / PageID {page_id}] Ambiguous ActionData shared by condition and data-consuming Action")
            if not row["ActionData"]:
                raise ValueError(f"ERROR [row {row_number} / PageID {page_id}] HAS_ITEM needs an item name in ActionData")
            condition = {"type": "HAS_ITEM", "data": row["ActionData"]}
            action_payloads = {}
        else:
            action_payloads = payloads_for(actions, row["ActionData"], row_number, page_id)

        compiled_actions = []
        for action in actions:
            normalized = "DROPDOWN_CHOICE" if action == "PASSWORD_INPUT" else action
            if action == "PASSWORD_INPUT":
                warnings.append(f"Page {page_id}: PASSWORD_INPUT normalized to DROPDOWN_CHOICE")
            if action in NO_DATA_ACTIONS:
                compiled_actions.append({"type": normalized})
            elif action in {"DROPDOWN_INVENTORY", "DROPDOWN_CHOICE", "PASSWORD_INPUT"}:
                compiled_actions.append({
                    "type": normalized,
                    "options": parse_dropdown(action_payloads[action], row_number, page_id),
                })
            elif action == "START_TIMER":
                value = action_payloads[action]
                compiled_actions.append({
                    "type": action,
                    "durationMs": parse_duration(value, row_number, page_id),
                    "raw": value,
                })
            else:
                compiled_actions.append({"type": action, "data": action_payloads[action]})

        encounter_id = page_id[:2]
        encounter = game["encounters"].setdefault(encounter_id, {"startPage": encounter_id + "01", "pages": {}})
        encounter["pages"][page_id] = {
            "id": page_id,
            "speaker": row["NPC"] or "",
            "text": row["Text"] or "",
            "buttons": buttons,
            "actions": compiled_actions,
            "condition": condition,
        }

    # Cross-reference validation.
    for encounter_id, encounter in game["encounters"].items():
        if encounter["startPage"] not in all_ids:
            raise ValueError(f"Encounter {encounter_id} is missing required start page {encounter['startPage']}")
        for page_id, page in encounter["pages"].items():
            if not page_id.startswith(encounter_id):
                raise ValueError(f"Page {page_id} is stored under the wrong encounter")
            for button in page["buttons"]:
                target = button["next"]
                if target not in all_ids and target not in SPECIAL_DESTINATIONS:
                    raise ValueError(f"ERROR [PageID {page_id}] Unknown Next target: {target}")
            for action in page["actions"]:
                for option in action.get("options", []):
                    target = option["next"]
                    if target not in all_ids and target not in SPECIAL_DESTINATIONS:
                        raise ValueError(f"ERROR [PageID {page_id}] Unknown dropdown target: {target}")
                if action["type"] == "DROPDOWN_INVENTORY":
                    labels = {o["label"] for o in action["options"]}
                    if "Other" not in labels:
                        warnings.append(f"Page {page_id}: inventory dropdown has no Other fallback")

    game["compilerWarnings"] = warnings
    return game


def main() -> None:
    game = compile_data()
    OUT_JSON.write_text(json.dumps(game, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_JS.write_text("window.QR_CITY_QUEST_DATA = " + json.dumps(game, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    page_count = sum(len(e["pages"]) for e in game["encounters"].values())
    print(f"Compiled {page_count} pages across {len(game['encounters'])} encounters.")
    for warning in game["compilerWarnings"]:
        print("WARNING:", warning)


if __name__ == "__main__":
    main()
