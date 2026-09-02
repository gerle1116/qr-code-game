#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
game = json.loads((ROOT / "data" / "game-data.json").read_text(encoding="utf-8"))
pages = {pid: page for enc in game["encounters"].values() for pid, page in enc["pages"].items()}

assert len(game["encounters"]) == 10, "Expected 10 encounters (01–10)"
assert len(pages) == 120, "Expected 120 dialogue pages"
for encounter_id, encounter in game["encounters"].items():
    assert encounter["startPage"] == encounter_id + "01"
    assert encounter["startPage"] in pages
for page_id, page in pages.items():
    assert re.fullmatch(r"\d{4}", page_id)
    for button in page["buttons"]:
        assert button["next"] in pages or button["next"] in {"-1", "TITLE_SCREEN"}
    for action in page["actions"]:
        for option in action.get("options", []):
            assert option["next"] in pages or option["next"] in {"-1", "TITLE_SCREEN"}

assert pages["0601"]["condition"] == {"type": "HAS_ITEM", "data": "Mark of Goblins"}
assert pages["1006"]["actions"][0]["type"] == "DROPDOWN_CHOICE"
assert pages["1011"]["buttons"][0]["next"] == "TITLE_SCREEN"
assert any(a.get("durationMs") == 1_200_000 for a in pages["0404"]["actions"])
assert any(a.get("durationMs") == 300_000 for a in pages["0504"]["actions"])
print("PASS: build data validation (10 encounters / 120 pages).")
