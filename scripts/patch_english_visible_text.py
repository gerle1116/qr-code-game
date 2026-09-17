from pathlib import Path
import subprocess

path = Path("data/game-data_en.js")
text = path.read_text(encoding="utf-8")

for old in ('"label": "ok"', '"label": "Ok"', '"label": "Okay"'):
    text = text.replace(old, '"label": "OK"')

for old, new in [
    ('"label": "practice"', '"label": "Practice"'),
    ('"label": "throw it"', '"label": "Throw it"'),
    ('"label": "stomp it"', '"label": "Stomp it"'),
    ('"label": "reel"', '"label": "Reel"'),
    ('"label": "wait"', '"label": "Wait"'),
    ('"label": "inflate"', '"label": "Inflate"'),
    ('"label": "inspect"', '"label": "Inspect"'),
]:
    if old not in text:
        raise SystemExit(f"Missing expected label: {old}")
    text = text.replace(old, new)

replacements = [
    ('Hello Boy. Are you interested in how this whole world works?', 'Hello, boy. Are you interested in how this whole world works?'),
    ('"label": "What are they"', '"label": "What are they?"'),
    ('"label": "Who"', '"label": "Who?"'),
    ("I'm on a hurry but I can give you a few minutes.", "I'm in a hurry but I can give you a few minutes."),
    ('"label": "Who are you"', '"label": "Who are you?"'),
    ('"label": "How to get in to the castle?"', '"label": "How do I get into the castle?"'),
    ('between the fountains stones.', 'between the fountain stones.'),
    ('Well have you seen the city guard?', 'Well, have you seen the city guard?'),
    ('Hello who are you?', 'Hello, who are you?'),
    ('Hello come with me!', 'Hello, come with me!'),
    ('the mark of goblins. Let me gift', 'the Mark of Goblins. Let me gift'),
    ('"label": "Ok bye"', '"label": "Okay, bye"'),
    ('Here! take this lucky Pebble', 'Here! Take this lucky pebble.'),
    ('"label": "Do you have something else"', '"label": "Do you have something else?"'),
    ('I like crystal shard better:', 'I like Crystal Shard better:'),
    ('First 5 letter: O, T, T, F, F, S... Whats next 2?', "First 6 letters: O, T, T, F, F, S... What's next 2?"),
    ('"label": "DROPDOWN"', '"label": "Choose answer"'),
    ('"label": "What are you doing here"', '"label": "What are you doing here?"'),
    ('"label": "What about a blobfish"', '"label": "What about a blobfish?"'),
    ('trying catching a great salmon', 'trying to catch a great salmon'),
    ('"label": "Can I help you"', '"label": "Can I help you?"'),
    ("I'm in hurry. Only come back", "I'm in a hurry. Only come back"),
    ('Hello do you want to help me in something?', 'Hello, do you want to help me in something?'),
    ('A small Warning: DONT!', "A small warning: DON'T!"),
    ('Its just an old scroll folded up!', "It's just an old scroll folded up!"),
    ('and its a little bit dirty.', "and it's a little bit dirty."),
    ('Ypu unfold it', 'You unfold it'),
    ('happens wxpect you look', 'happens except you look'),
    ('"label": "Combin it with an item"', '"label": "Combine it with an item"'),
    ('"text": "choose an item from inventory:"', '"text": "Choose an item from inventory:"'),
    ('"text": "Nothing happens"', '"text": "Nothing happens."'),
    ('Password:Applepie', 'Password:ApplePie'),
    ('"label": "Swing It"', '"label": "Swing it"'),
    ("horn You've got from tree.", "horn you've got from tree."),
    ('"label": "Lets hear her"', '"label": "Let\'s hear her"'),
    ('A silver Key. You can open the bridge with it.', 'A silver key. You can open the bridge with it.'),
    ('Password:”apple pie”.', 'Password:”ApplePie”.'),
    ('"text": "You start pulling it in, you struggle, and then ta-da, there is a large salmon"', '"text": "You start pulling it in, you struggle, and then ta-da, there is a large salmon."'),
    ('"text": "you struggle and fail for a long time. Then you give up."', '"text": "You struggle and fail for a long time. Then you give up."'),
    ('The words On the paper read, “password: applepie.”', 'The words on the paper read, “password: ApplePie.”'),
    ('Wait…its still alive!', "Wait… it's still alive!"),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one match for {old!r}, found {count}")
    text = text.replace(old, new, 1)

for marker in ['"label": "ok"', '"label": "Ok"', '"label": "Okay"', 'Applepie', 'applepie', 'Ypu unfold', 'wxpect', 'Combin it with an item']:
    if marker in text:
        raise SystemExit(f"Old visible text remains: {marker}")

for marker in ['"data": "Blobfish"', '"data": "Gold Coin"', '"data": "Get Blobfish for Merchant"', '"requiredArea": "CASTLE_SIDE"', '"type": "ADD_ITEM"', '"type": "REMOVE_ITEM"', '"next": "HOME"', '"label": "YAY"', "I don't need THAT!"]:
    if marker not in text:
        raise SystemExit(f"Required marker missing: {marker}")

path.write_text(text, encoding="utf-8")
subprocess.run(["node", "--check", str(path)], check=True)
subprocess.run(["git", "diff", "--check"], check=True)
print("English visible-text cleanup validated.")
