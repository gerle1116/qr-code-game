window.QR_CITY_QUEST_DATA = {
  "formatVersion": 1,
  "generatedFrom": "Gergo-app-prototype-item-actions-fixed + QR_City_Quest_Item_Data.md",
  "encounters": {
    "10": {
      "defaultPicture": "warrior",
      "requiredArea": "CASTLE_SIDE",
      "startPage": "1001",
      "pages": {
        "1001": {
          "id": "1001",
          "speaker": "Harcos",
          "text": "Szia! Ha be akarsz jutni, tudnod kell a jelszót!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké, viszlát",
              "next": "1001"
            },
            {
              "index": 2,
              "label": "Nem tudom, de mutatok valamit",
              "next": "1002"
            },
            {
              "index": 3,
              "label": "Tudom",
              "next": "1003"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "castle_requires_password"
            }
          ],
          "condition": {}
        },
        "1002": {
          "id": "1002",
          "picture": "warrior-arms-crossed",
          "speaker": "Harcos",
          "text": "Válassz egy tárgyat a felszerelésedből.",
          "buttons": [
            {
              "index": 1,
              "label": "Válassz tárgyat",
              "next": "1005"
            }
          ],
          "actions": [
            {
              "type": "DROPDOWN_INVENTORY",
              "options": [
                {
                  "value": "Ruby Sword",
                  "label": "Rubinkard",
                  "next": "1005"
                },
                {
                  "value": "Magic Branch",
                  "label": "Varázság",
                  "next": "1010"
                }
              ],
              "otherNext": "1004"
            }
          ],
          "condition": {}
        },
        "1003": {
          "id": "1003",
          "speaker": "Harcos",
          "text": "Akkor mi az?",
          "buttons": [
            {
              "index": 1,
              "label": "Válaszd ki az első részt",
              "next": "1006"
            }
          ],
          "actions": [
            {
              "type": "DROPDOWN_CHOICE",
              "options": [
                {
                  "label": "Almás",
                  "next": "1006"
                },
                {
                  "label": "Narancs",
                  "next": "1008"
                },
                {
                  "label": "Szilva",
                  "next": "1008"
                },
                {
                  "label": "Körte",
                  "next": "1008"
                },
                {
                  "label": "Őszibarack",
                  "next": "1008"
                }
              ]
            }
          ],
          "condition": {}
        },
        "1004": {
          "id": "1004",
          "picture": "warrior-holds-sword",
          "speaker": "Harcos",
          "text": "Nem, ezzel nem juthatsz be.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "1001"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "1005": {
          "id": "1005",
          "speaker": "Harcos",
          "text": "Ha, harcolni akarsz?",
          "buttons": [
            {
              "index": 1,
              "label": "Nem, viszlát",
              "next": "1001"
            },
            {
              "index": 2,
              "label": "Oda akarom adni neked",
              "next": "1004"
            },
            {
              "index": 3,
              "label": "Igen",
              "next": "1009"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "1006": {
          "id": "1006",
          "speaker": "Harcos",
          "text": "Válaszd ki a második részt.",
          "buttons": [
            {
              "index": 1,
              "label": "Válaszd ki a második részt",
              "next": "1007"
            }
          ],
          "actions": [
            {
              "type": "DROPDOWN_CHOICE",
              "options": [
                {
                  "label": "Pite",
                  "next": "1007"
                },
                {
                  "label": "Lé",
                  "next": "1008"
                },
                {
                  "label": "Fa",
                  "next": "1008"
                },
                {
                  "label": "Íz",
                  "next": "1008"
                },
                {
                  "label": "Gyümölcs",
                  "next": "1008"
                }
              ]
            }
          ],
          "condition": {}
        },
        "1007": {
          "id": "1007",
          "picture": "warrior-open-gate-side",
          "speaker": "Harcos",
          "text": "Nos... ez helyes! Bemehetsz.",
          "buttons": [
            {
              "index": 1,
              "label": "HURRÁ",
              "next": "1011"
            }
          ],
          "actions": [
            {
              "type": "OPEN_CASTLE"
            }
          ],
          "condition": {}
        },
        "1008": {
          "id": "1008",
          "picture": "warrior-holds-sword",
          "speaker": "Harcos",
          "text": "Nos... ez helytelen. Kint kell maradnod!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "1001"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "1009": {
          "id": "1009",
          "picture": "warrior-defeated-weaponless",
          "speaker": "Harcos",
          "text": "Gyerünk!! Semmi sem történik. Egy dinoszaurusz kiugrik a kezedből, és két csapással legyőzi az őrt.",
          "buttons": [
            {
              "index": 1,
              "label": "Bemehetek?",
              "next": "1007"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "1010": {
          "id": "1010",
          "speaker": "Harcos",
          "text": "Meglengeted. Apró szivárványszikrák jelennek meg, de semmi más.",
          "buttons": [
            {
              "index": 1,
              "label": "Viszlát",
              "next": "1001"
            },
            {
              "index": 2,
              "label": "Ha ha ha ha ha ha ha ha...",
              "next": "1010"
            },
            {
              "index": 3,
              "label": "Oda akarom adni neked",
              "next": "1004"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "1011": {
          "id": "1011",
          "speaker": "Harcos",
          "text": "Nyertél!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "TITLE_SCREEN"
            }
          ],
          "actions": [],
          "condition": {}
        }
      }
    },
    "33": {
      "startPage": "3301",
      "pages": {
        "3301": {
          "id": "3301",
          "speaker": "Madár",
          "text": "Szia! Tudnál hozni nekem dolgokat?",
          "buttons": [
            {
              "index": 1,
              "label": "Igen",
              "next": "3302"
            },
            {
              "index": 2,
              "label": "Nem",
              "next": "3303"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "3302": {
          "id": "3302",
          "speaker": "Madár",
          "text": "Elsősorban egy kis szalmára lenne szükségem a fészek rakásához.",
          "buttons": [
            {
              "index": 1,
              "label": "Jó",
              "next": "3304"
            },
            {
              "index": 2,
              "label": "Van nálam szalma",
              "next": "3305"
            }
          ],
          "actions": [
            {
              "type": "START_QUEST",
              "data": "Bird1"
            },
            {
              "type": "NEXT_SCAN",
              "buttonIndex": 1
            }
          ],
          "condition": {}
        },
        "3303": {
          "id": "3303",
          "speaker": "Madár",
          "text": "Akkor viszont hagyj dolgozni kérlek.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "3301"
            },
            {
              "index": 2,
              "label": "Jó",
              "next": "3304"
            },
            {
              "index": 3,
              "label": "Rendben",
              "next": "3307"
            },
            {
              "index": 4,
              "label": "Okés",
              "next": "3309"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN",
              "buttonIndex": 1
            },
            {
              "type": "NEXT_SCAN",
              "buttonIndex": 2
            },
            {
              "type": "NEXT_SCAN",
              "buttonIndex": 3
            },
            {
              "type": "NEXT_SCAN",
              "buttonIndex": 4
            }
          ],
          "condition": {
            "1": "save.quests[\"Bird1\"] !== \"active\" && save.quests[\"Bird2\"] !== \"active\" && save.quests[\"Bird3\"] !== \"active\"",
            "2": "save.quests[\"Bird1\"] === \"active\"",
            "3": "save.quests[\"Bird2\"] === \"active\"",
            "4": "save.quests[\"Bird3\"] === \"active\""
          }
        },
        "3304": {
          "id": "3304",
          "speaker": "Madár",
          "text": "Helló!!! Hoztál szalmát?",
          "buttons": [
            {
              "index": 1,
              "label": "Igen",
              "next": "3305"
            },
            {
              "index": 2,
              "label": "Nem",
              "next": "3303"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "3305": {
          "id": "3305",
          "speaker": "Madár",
          "text": "Na, muti!",
          "buttons": [
            {
              "index": 1,
              "label": "Tárgyak",
              "next": "3306"
            }
          ],
          "actions": [
            {
              "type": "DROPDOWN_INVENTORY",
              "options": [
                {
                  "value": "Straw",
                  "label": "Szalma",
                  "next": "3306"
                },
                {
                  "value": "Mosquito",
                  "label": "Szúnyog",
                  "next": "3308"
                },
                {
                  "value": "Sketch3",
                  "label": "Vázlat3",
                  "next": "3310"
                }
              ],
              "otherNext": "3303"
            }
          ],
          "condition": {}
        },
        "3306": {
          "id": "3306",
          "speaker": "Madár",
          "text": "Következőleg kérlek szerezzél szúnyogot a szúnyogvadászoktól.",
          "buttons": [
            {
              "index": 1,
              "label": "Jó",
              "next": "3307"
            }
          ],
          "actions": [
            {
              "type": "REMOVE_ITEM",
              "data": "Straw"
            },
            {
              "type": "COMPLETE_QUEST",
              "data": "Bird1"
            },
            {
              "type": "START_QUEST",
              "data": "Bird2"
            },
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "3307": {
          "id": "3307",
          "speaker": "Madár",
          "text": "Hoztál szúnyogot?",
          "buttons": [
            {
              "index": 1,
              "label": "Igen",
              "next": "3305"
            },
            {
              "index": 2,
              "label": "Nem",
              "next": "3303"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "3308": {
          "id": "3308",
          "speaker": "Madár",
          "text": "Végül utoljára tudnál keresni egy vázlatot egy megfelelő helyről, ahova a fészkemet tudnám rakni?",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "3309"
            }
          ],
          "actions": [
            {
              "type": "REMOVE_ITEM",
              "data": "Mosquito"
            },
            {
              "type": "COMPLETE_QUEST",
              "data": "Bird2"
            },
            {
              "type": "START_QUEST",
              "data": "Bird3"
            },
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "3309": {
          "id": "3309",
          "speaker": "Madár",
          "text": "Helló! Meghoztad a vázlatot a megfelelő fészkelőhelyről?",
          "buttons": [
            {
              "index": 1,
              "label": "Igen",
              "next": "3305"
            },
            {
              "index": 2,
              "label": "Nem",
              "next": "3303"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "3310": {
          "id": "3310",
          "speaker": "Madár",
          "text": "Köszönöm szépen! Most már végre fészket rakhatok! Cserébe elmondom, hogy a jelszónak a 3. része \"011\". Most sietek fészket rakni.",
          "buttons": [
            {
              "index": 1,
              "label": "Szia!",
              "next": "3311"
            }
          ],
          "actions": [
            {
              "type": "REMOVE_ITEM",
              "data": "Sketch3"
            },
            {
              "type": "COMPLETE_QUEST",
              "data": "Bird3"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "Password3"
            },
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "3311": {
          "id": "3311",
          "speaker": "Madár",
          "text": "A madárka nincsen itt.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "3311"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        }
      }
    },
    "34": {
      "startPage": "3401",
      "pages": {
        "3401": {
          "id": "3401",
          "speaker": "Vidra",
          "text": "Hali! Milyen napod van? Keresel valamit?",
          "buttons": [
            {
              "index": 1,
              "label": "Jó napom van!",
              "next": "3402"
            },
            {
              "index": 2,
              "label": "Talán...",
              "next": "3403"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "3402": {
          "id": "3402",
          "speaker": "Vidra",
          "text": "Tényleg? Az fantasztikus! Erről jut eszembe... Nem is tudom...",
          "buttons": [
            {
              "index": 1,
              "label": "Mi az?",
              "next": "3404"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "3403": {
          "id": "3403",
          "speaker": "Vidra",
          "text": "Azta! Ez biztos izgalmas! Én is keresni akartam valamit...",
          "buttons": [
            {
              "index": 1,
              "label": "Mit?",
              "next": "3404"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "3404": {
          "id": "3404",
          "speaker": "Vidra",
          "text": "Ja! Nagy halat kéne halásznom, mert már éhes vagyok! Na! Szia! Majd jövök.",
          "buttons": [
            {
              "index": 1,
              "label": "Szervusz",
              "next": "3405"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "3405": {
          "id": "3405",
          "speaker": "Vidra",
          "text": "Most nincs itt a vidra...",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "3406"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "3406": {
          "id": "3406",
          "speaker": "Vidra",
          "text": "Hali! Most már tele a pocak!",
          "buttons": [
            {
              "index": 1,
              "label": "Hogy vagy?",
              "next": "3407"
            },
            {
              "index": 2,
              "label": "Milyen halat fogtál?",
              "next": "3408"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "3407": {
          "id": "3407",
          "speaker": "Vidra",
          "text": "Jó. Egy finom ebéd mindig jó kedvre derít! Viszont most mennem kell találkozni valakivel...",
          "buttons": [
            {
              "index": 1,
              "label": "Szia!",
              "next": "3409"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "3408": {
          "id": "3408",
          "speaker": "Vidra",
          "text": "Én egy nagy pontyot fogtam. Meg egy bluggyhalat. De az hami volt fiam... Most viszont megyek. Fölfalnivalóm van!",
          "buttons": [
            {
              "index": 1,
              "label": "Szia",
              "next": "3409"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "3409": {
          "id": "3409",
          "speaker": "Vidra",
          "text": "Hali! Olyan jó volt veled beszélgetni! Most már barátok vagyunk?",
          "buttons": [
            {
              "index": 1,
              "label": "Igen",
              "next": "3410"
            },
            {
              "index": 2,
              "label": "Nem. Szia!",
              "next": "3409"
            },
            {
              "index": 3,
              "label": "Naná",
              "next": "3411"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN",
              "buttonIndex": 2
            }
          ],
          "condition": {
            "1": "!knowledge.includes(\"Password1\")",
            "2": "!knowledge.includes(\"Password1\")",
            "3": "knowledge.includes(\"Password1\")"
          }
        },
        "3410": {
          "id": "3410",
          "speaker": "Vidra",
          "text": "Akkor elárulom, hogy a jelszó első része: \"7\".",
          "buttons": [
            {
              "index": 1,
              "label": "Köszi",
              "next": "3409"
            }
          ],
          "actions": [
            {
              "type": "ADD_KNOWLEDGE",
              "data": "Password1"
            },
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "3411": {
          "id": "3411",
          "speaker": "Vidra",
          "text": "Jó, hogy még mindig így gondolunk egymásról.",
          "buttons": [
            {
              "index": 1,
              "label": "Igen",
              "next": "3409"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        }
      }
    },
    "35": {
      "startPage": "3501",
      "pages": {
        "3501": {
          "id": "3501",
          "speaker": "Gém",
          "text": "Mit keresel itt?",
          "buttons": [
            {
              "index": 1,
              "label": "Semmit",
              "next": "3502"
            },
            {
              "index": 2,
              "label": "Akármit",
              "next": "3503"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "3502": {
          "id": "3502",
          "speaker": "Gém",
          "text": "Na akkor lódulj innen!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké...",
              "next": "3506"
            },
            {
              "index": 2,
              "label": "Jó...",
              "next": "3504"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN",
              "buttonIndex": 1
            },
            {
              "type": "NEXT_SCAN",
              "buttonIndex": 2
            }
          ],
          "condition": {
            "1": "save.quests[\"Gém1\"] === \"active\"",
            "2": "save.quests[\"Gém1\"] === undefined"
          }
        },
        "3503": {
          "id": "3503",
          "speaker": "Gém",
          "text": "Na, \"akármit\" elég sokat találsz errefelé! Ehhez nem kellett volna engem zavarni!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké. Szia...",
              "next": "3504"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "3504": {
          "id": "3504",
          "speaker": "Gém",
          "text": "Minek zavarsz megint?",
          "buttons": [
            {
              "index": 1,
              "label": "Csak barangoltam",
              "next": "3505"
            },
            {
              "index": 2,
              "label": "Semmit",
              "next": "3502"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "3505": {
          "id": "3505",
          "speaker": "Gém",
          "text": "Addig nem mondok semmit, amíg nem szerzel nekem egy aranyalmát a fáról!",
          "buttons": [
            {
              "index": 1,
              "label": "Jó",
              "next": "3506"
            }
          ],
          "actions": [
            {
              "type": "START_QUEST",
              "data": "Gém1"
            },
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "3506": {
          "id": "3506",
          "speaker": "Gém",
          "text": "Megszerezted?",
          "buttons": [
            {
              "index": 1,
              "label": "Tárgyak",
              "next": "3507"
            }
          ],
          "actions": [
            {
              "type": "DROPDOWN_INVENTORY",
              "options": [
                {
                  "value": "Golden Apple",
                  "label": "Aranyalma",
                  "next": "3507"
                }
              ],
              "otherNext": "3504"
            }
          ],
          "condition": {}
        },
        "3507": {
          "id": "3507",
          "speaker": "Gém",
          "text": "Kösz, köszönöm! Cserébe elárulom, hogy a jelszó második része \"891\". Most viszont lódulj innen!",
          "buttons": [
            {
              "index": 1,
              "label": "Jó",
              "next": "3508"
            }
          ],
          "actions": [
            {
              "type": "REMOVE_ITEM",
              "data": "Golden Apple"
            },
            {
              "type": "COMPLETE_QUEST",
              "data": "Gém1"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "Password2"
            },
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "3508": {
          "id": "3508",
          "speaker": "Gém",
          "text": "Sipirc.",
          "buttons": [
            {
              "index": 1,
              "label": "Szia",
              "next": "3508"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        }
      }
    },
    "01": {
      "defaultPicture": "child",
      "startPage": "0101",
      "pages": {
        "0101": {
          "id": "0101",
          "speaker": "Gyerek",
          "text": "Veszel nekem egy kis édességet?",
          "buttons": [
            {
              "index": 1,
              "label": "Igen",
              "next": "0102"
            },
            {
              "index": 2,
              "label": "Nem",
              "next": "0103"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0102": {
          "id": "0102",
          "speaker": "Gyerek",
          "text": "A Kereskedőtől vehetsz.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0104"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "START_QUEST",
              "data": "Buy Sweets"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "sweets_from_merchant"
            }
          ],
          "condition": {}
        },
        "0103": {
          "id": "0103",
          "picture": "child-back",
          "speaker": "Gyerek",
          "text": "Oké, akkor hagyj békén!",
          "buttons": [
            {
              "index": 1,
              "label": "Viszlát",
              "next": "0101"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0104": {
          "id": "0104",
          "speaker": "Gyerek",
          "text": "Van nálad édesség?",
          "buttons": [
            {
              "index": 1,
              "label": "Igen",
              "next": "0105"
            },
            {
              "index": 2,
              "label": "Nem",
              "next": "0108"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0105": {
          "id": "0105",
          "speaker": "Gyerek",
          "text": "Mutasd!",
          "buttons": [
            {
              "index": 1,
              "label": "Válassz tárgyat",
              "next": "0106"
            }
          ],
          "actions": [
            {
              "type": "DROPDOWN_INVENTORY",
              "options": [
                {
                  "value": "Sweets",
                  "label": "Édesség",
                  "next": "0106"
                }
              ],
              "otherNext": "0103"
            }
          ],
          "condition": {}
        },
        "0106": {
          "id": "0106",
          "speaker": "Gyerek",
          "text": "Hallottam, amikor a Hírnök egy jelszót mondott a Harcosnak. Valami olyasmi volt, hogy „...pite”.",
          "buttons": [
            {
              "index": 1,
              "label": "Köszi",
              "next": "0107"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "REMOVE_ITEM",
              "data": "Sweets"
            },
            {
              "type": "COMPLETE_QUEST",
              "data": "Buy Sweets"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "password_ending_pie"
            }
          ],
          "condition": {}
        },
        "0107": {
          "id": "0107",
          "picture": "child-gone",
          "speaker": "Gyerek",
          "text": "A gyereket sehol sem látod.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0107"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0108": {
          "id": "0108",
          "picture": "child-back",
          "speaker": "Gyerek",
          "text": "Legközelebb legyen nálad!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0104"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        }
      }
    },
    "02": {
      "defaultPicture": "merchant",
      "startPage": "0201",
      "pages": {
        "0201": {
          "id": "0201",
          "speaker": "Kereskedő",
          "text": "Üdv, vásárló! Akarsz venni valamit?",
          "buttons": [
            {
              "index": 1,
              "label": "Igen",
              "next": "0202"
            },
            {
              "index": 2,
              "label": "Nem",
              "next": "0203"
            },
            {
              "index": 3,
              "label": "Igen",
              "next": "0215"
            }
          ],
          "actions": [],
          "condition": {
            "1": "!had_item.includes(\"Sweets\") || !had_item.includes(\"Old Scroll\")",
            "3": "had_item.includes(\"Sweets\") && had_item.includes(\"Old Scroll\")"
          }
        },
        "0202": {
          "id": "0202",
          "picture": "merchant-choice-items",
          "speaker": "Kereskedő",
          "text": "Van néhány eladó dolgom. Melyiket szeretnéd?",
          "buttons": [
            {
              "index": 1,
              "label": "Édesség",
              "next": "0204"
            },
            {
              "index": 2,
              "label": "Régi tekercs",
              "next": "0205"
            },
            {
              "index": 3,
              "label": "Most nem kérek semmit.",
              "next": "0203"
            }
          ],
          "actions": [],
          "condition": {
            "1": "!had_item.includes(\"Sweets\")",
            "2": "!had_item.includes(\"Old Scroll\")",
            "3": "had_item.includes(\"Sweets\") || had_item.includes(\"Old Scroll\")"
          }
        },
        "0203": {
          "id": "0203",
          "speaker": "Kereskedő",
          "text": "Oké, de van egy kis szabadidőd? Örülnék, ha szereznél nekem néhány különleges hozzávalót.",
          "buttons": [
            {
              "index": 1,
              "label": "Nem, mennem kell",
              "next": "0201"
            },
            {
              "index": 2,
              "label": "Igen",
              "next": "0206"
            },
            {
              "index": 3,
              "label": "Igen",
              "next": "0214"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {
            "2": "save.quests[\"Get Blobfish for Merchant\"] === undefined",
            "3": "save.quests[\"Get Blobfish for Merchant\"] !== undefined"
          }
        },
        "0204": {
          "id": "0204",
          "picture": "merchant-asking-hand",
          "speaker": "Kereskedő",
          "text": "Oké, akkor aranyérme lesz. Válassz egy tárgyat a felszerelésedből.",
          "buttons": [
            {
              "index": 1,
              "label": "Válassz tárgyat",
              "next": "0207"
            }
          ],
          "actions": [
            {
              "type": "DROPDOWN_INVENTORY",
              "options": [
                {
                  "value": "Gold Coin",
                  "label": "Aranyérme",
                  "next": "0207"
                }
              ],
              "otherNext": "0208"
            }
          ],
          "condition": {}
        },
        "0205": {
          "id": "0205",
          "picture": "merchant-asking-hand",
          "speaker": "Kereskedő",
          "text": "Oké, akkor Priclys tolla lesz. Válassz egy tárgyat a felszerelésedből.",
          "buttons": [
            {
              "index": 1,
              "label": "Válassz tárgyat",
              "next": "0209"
            }
          ],
          "actions": [
            {
              "type": "DROPDOWN_INVENTORY",
              "options": [
                {
                  "value": "Priclys Feather",
                  "label": "Priclys tolla",
                  "next": "0209"
                }
              ],
              "otherNext": "0208"
            }
          ],
          "condition": {}
        },
        "0206": {
          "id": "0206",
          "picture": "merchant-reading-list",
          "speaker": "Kereskedő",
          "text": "Ha tudnál szerezni nekem egy Bluggyhalat, nagyon örülnék. Szia-szia.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0210"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "START_QUEST",
              "data": "Get Blobfish for Merchant"
            }
          ],
          "condition": {}
        },
        "0207": {
          "id": "0207",
          "picture": "merchant-offers-sweets",
          "speaker": "Kereskedő",
          "text": "Tessék, egy kis édesség! Van egy kis szabadidőd?",
          "buttons": [
            {
              "index": 1,
              "label": "Nem, mennem kell",
              "next": "0201"
            },
            {
              "index": 2,
              "label": "Igen",
              "next": "0206"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "REMOVE_ITEM",
              "data": "Gold Coin"
            },
            {
              "type": "ADD_ITEM",
              "data": "Sweets"
            },
            {
              "type": "RESET_COUNTER",
              "item": "Sweets",
              "data": "eatAttempts"
            }
          ],
          "condition": {}
        },
        "0208": {
          "id": "0208",
          "speaker": "Kereskedő",
          "text": "Ez nem kell!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0201"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0209": {
          "id": "0209",
          "picture": "merchant-offers-scroll",
          "speaker": "Kereskedő",
          "text": "Itt a régi tekercs. Van egy kis szabadidőd?",
          "buttons": [
            {
              "index": 1,
              "label": "Nem, mennem kell",
              "next": "0201"
            },
            {
              "index": 2,
              "label": "Igen",
              "next": "0206"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "REMOVE_ITEM",
              "data": "Priclys Feather"
            },
            {
              "type": "ADD_ITEM",
              "data": "Old Scroll"
            }
          ],
          "condition": {}
        },
        "0210": {
          "id": "0210",
          "speaker": "Kereskedő",
          "text": "Nálad van a halam?",
          "buttons": [
            {
              "index": 1,
              "label": "Nem",
              "next": "0211"
            },
            {
              "index": 2,
              "label": "Igen",
              "next": "0212"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0211": {
          "id": "0211",
          "speaker": "Kereskedő",
          "text": "Legalább vásárolni akarsz valamit?",
          "buttons": [
            {
              "index": 1,
              "label": "Nem, mennem kell",
              "next": "0201"
            },
            {
              "index": 2,
              "label": "Aha",
              "next": "0202"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0212": {
          "id": "0212",
          "picture": "merchant-asking-hand",
          "speaker": "Kereskedő",
          "text": "Odaadnád nekem őket?",
          "buttons": [
            {
              "index": 1,
              "label": "Válassz tárgyat",
              "next": "0213"
            }
          ],
          "actions": [
            {
              "type": "DROPDOWN_INVENTORY",
              "options": [
                {
                  "value": "Blobfish",
                  "label": "Bluggyhal",
                  "next": "0213"
                }
              ],
              "otherNext": "0208"
            }
          ],
          "condition": {}
        },
        "0213": {
          "id": "0213",
          "speaker": "Kereskedő",
          "text": "Oké. Szép. Nem sok mindent tudok mondani, de azt hallottam, hogy a Troll találós kérdésében a betűk valahogy számokhoz kapcsolódnak.",
          "buttons": [
            {
              "index": 1,
              "label": "Viszlát",
              "next": "0201"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "REMOVE_ITEM",
              "data": "Blobfish"
            },
            {
              "type": "COMPLETE_QUEST",
              "data": "Get Blobfish for Merchant"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "troll_letters_are_numbers"
            }
          ],
          "condition": {}
        },
        "0214": {
          "id": "0214",
          "speaker": "Kereskedő",
          "text": "Oké, akkor csináld a feladataidat!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0201"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0215": {
          "id": "0215",
          "speaker": "Kereskedő",
          "text": "Sajnálom, de most nincs semmi, amit eladhatnék neked.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké, szia",
              "next": "0201"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        }
      }
    },
    "03": {
      "defaultPicture": "guard",
      "startPage": "0301",
      "pages": {
        "0301": {
          "id": "0301",
          "speaker": "Őr",
          "text": "Szia, fiú. Érdekel, hogyan működik ez az egész világ?",
          "buttons": [
            {
              "index": 1,
              "label": "Igen",
              "next": "0302"
            },
            {
              "index": 2,
              "label": "Nem, csak kóborlok",
              "next": "0303"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0302": {
          "id": "0302",
          "picture": "guard-map-village-center",
          "speaker": "Őr",
          "text": "Elmondom! Ez a hely különböző területekből áll. Ez a Faluközpont. Van még 3 másik terület...",
          "buttons": [
            {
              "index": 1,
              "label": "Mik azok?",
              "next": "0304"
            },
            {
              "index": 2,
              "label": "Ennyi elég",
              "next": "0306"
            }
          ],
          "actions": [
            {
              "type": "ADD_KNOWLEDGE",
              "data": "village_centre"
            }
          ],
          "condition": {}
        },
        "0303": {
          "id": "0303",
          "speaker": "Őr",
          "text": "És tudod, hol vagy?",
          "buttons": [
            {
              "index": 1,
              "label": "Nem igazán",
              "next": "0302"
            },
            {
              "index": 2,
              "label": "Igen",
              "next": "0306"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0304": {
          "id": "0304",
          "picture": "guard-map-sections",
          "speaker": "Őr",
          "text": "A Liget, a Híd és a Kastélybejárat. Minden részen van egy vagy több ember, akivel beszélhetsz. Mindegyik rész könnyen elérhető, de a kastélyt a Troll őrzi.",
          "buttons": [
            {
              "index": 1,
              "label": "Ki?",
              "next": "0305"
            },
            {
              "index": 2,
              "label": "Nem kell több!",
              "next": "0306"
            }
          ],
          "actions": [
            {
              "type": "ADD_KNOWLEDGE",
              "data": "other_world_sections"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "castle_guarded_by_troll"
            }
          ],
          "condition": {}
        },
        "0305": {
          "id": "0305",
          "picture": "guard-troll-sketch",
          "speaker": "Őr",
          "text": "Egy troll. Csak akkor érheted el a bejáratot, ha legyőzöd. Ennyit tudok mondani. Jó szórakozást itt!",
          "buttons": [
            {
              "index": 1,
              "label": "Viszlát",
              "next": "0307"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "troll_blocks_castle"
            }
          ],
          "condition": {}
        },
        "0306": {
          "id": "0306",
          "speaker": "Őr",
          "text": "Akkor nincs több mondanivalóm.",
          "buttons": [
            {
              "index": 1,
              "label": "Viszlát",
              "next": "0307"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0307": {
          "id": "0307",
          "speaker": "Őr",
          "text": "Szia! Csak folytasd a felfedezést!",
          "buttons": [
            {
              "index": 1,
              "label": "Viszlát",
              "next": "0307"
            },
            {
              "index": 2,
              "label": "Van valamim neked",
              "next": "0308"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {
            "2": "save.inventory.includes(\"Golden Medal\")"
          }
        },
        "0308": {
          "id": "0308",
          "speaker": "Őr",
          "text": "Válassz egy tárgyat a felszerelésedből.",
          "buttons": [
            {
              "index": 1,
              "label": "Válassz tárgyat",
              "next": "0310"
            }
          ],
          "actions": [
            {
              "type": "DROPDOWN_INVENTORY",
              "options": [
                {
                  "value": "Golden Medal",
                  "label": "Aranymedál",
                  "next": "0310"
                }
              ],
              "otherNext": "0309"
            }
          ],
          "condition": {}
        },
        "0309": {
          "id": "0309",
          "speaker": "Őr",
          "text": "Erre nincs szükségem.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0307"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0310": {
          "id": "0310",
          "picture": "guard-delighted",
          "speaker": "Őr",
          "text": "Ó, az érmem! Köszönöm, hogy visszahoztad. Ezért neked adom a Goblinok jelét. A goblinok barátságosabbak lesznek, ha megmutatod nekik. Még egyszer köszönöm!!!",
          "buttons": [
            {
              "index": 1,
              "label": "Viszlát",
              "next": "0307"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "REMOVE_ITEM",
              "data": "Golden Medal"
            },
            {
              "type": "ADD_ITEM",
              "data": "Mark of Goblins"
            },
            {
              "type": "COMPLETE_QUEST",
              "data": "Return Golden Medal to Guard"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "mark_of_goblins"
            }
          ],
          "condition": {}
        }
      }
    },
    "04": {
      "defaultPicture": "talking-tree",
      "startPage": "0401",
      "pages": {
        "0401": {
          "id": "0401",
          "speaker": "Beszélő fa",
          "text": "Üdv, ember! Mit keresel itt?",
          "buttons": [
            {
              "index": 1,
              "label": "TUDSZ BESZÉLNI??",
              "next": "0402"
            },
            {
              "index": 2,
              "label": "Csak pletykák emberekről",
              "next": "0403"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0402": {
          "id": "0402",
          "speaker": "Beszélő fa",
          "text": "Örülök, hogy megkérdezted, bár nem fogom elárulni...",
          "buttons": [
            {
              "index": 1,
              "label": "Várok, beszéljünk később",
              "next": "0404"
            },
            {
              "index": 2,
              "label": "Most elmegyek",
              "next": "0407"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0403": {
          "id": "0403",
          "speaker": "Beszélő fa",
          "text": "Tudok dolgokat az emberekről. Mesélhetek róluk. Kiről szeretnél hallani?",
          "buttons": [
            {
              "index": 1,
              "label": "Hírnök",
              "next": "0405"
            },
            {
              "index": 2,
              "label": "Harcos",
              "next": "0406"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0404": {
          "id": "0404",
          "speaker": "Beszélő fa",
          "text": "Hamarosan elalszom úgy 20 percre. Utána megint beszélhetünk.",
          "buttons": [
            {
              "index": 1,
              "label": "Viszlát",
              "next": "0409"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "START_TIMER",
              "raw": "20 minutes",
              "durationMs": 1200000
            }
          ],
          "condition": {}
        },
        "0405": {
          "id": "0405",
          "speaker": "Beszélő fa",
          "text": "Az a fickó tényleg édesszájú. Meglepő módon a futást is utálja! Most pedig aludni megyek.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0408"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "messenger_personality"
            }
          ],
          "condition": {}
        },
        "0406": {
          "id": "0406",
          "speaker": "Beszélő fa",
          "text": "Csak egy erős harcos tudja legyőzni, méghozzá Koji kardjával. Most pedig pihenek.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0408"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "warrior_weakness"
            }
          ],
          "condition": {}
        },
        "0407": {
          "id": "0407",
          "picture": "talking-tree-magic-branch",
          "speaker": "Beszélő fa",
          "text": "Legalább ezt a varázságat odaadhatom neked, ami segíteni fog a küldetéseden. Ragaszkodom hozzá. Most pedig pihenni megyek.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0408"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "ADD_ITEM",
              "data": "Magic Branch"
            }
          ],
          "condition": {}
        },
        "0408": {
          "id": "0408",
          "speaker": "Beszélő fa",
          "text": "A fa alszik.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0408"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0409": {
          "id": "0409",
          "picture": "talking-tree-horn-hole",
          "speaker": "Beszélő fa",
          "text": "Szia megint. Emlékszem, mennyire meglepődtél, hogy egy ilyen csodálatos fa tud beszélni. Ezért neked adom a fák kürtjét. Ha megfújod, felébredek az álmomból. És most miben segíthetek?",
          "buttons": [
            {
              "index": 1,
              "label": "Néhány infó",
              "next": "0403"
            },
            {
              "index": 2,
              "label": "Nem tudom",
              "next": "0407"
            }
          ],
          "actions": [
            {
              "type": "ADD_ITEM",
              "data": "Horn of Trees"
            }
          ],
          "condition": {}
        },
        "0410": {
          "id": "0410",
          "speaker": "Beszélő fa",
          "text": "Szia megint. Tudok mesélni neked néhány emberről.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0403"
            },
            {
              "index": 2,
              "label": "Nem",
              "next": "0408"
            }
          ],
          "actions": [],
          "condition": {}
        }
      }
    },
    "05": {
      "defaultPicture": "hunter",
      "startPage": "0501",
      "pages": {
        "0501": {
          "id": "0501",
          "speaker": "Vadász",
          "text": "Üdv, utazó! Sietek, de pár percem van rád.",
          "buttons": [
            {
              "index": 1,
              "label": "Miért sietsz?",
              "next": "0502"
            },
            {
              "index": 2,
              "label": "Ki vagy te",
              "next": "0503"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0502": {
          "id": "0502",
          "speaker": "Vadász",
          "text": "Mindig sietek, mert azokra az egyedi fajokra vadászom, amelyeket ez a liget vonz ide.",
          "buttons": [
            {
              "index": 1,
              "label": "Miért vonzza őket ez a hely?",
              "next": "0504"
            },
            {
              "index": 2,
              "label": "Ki vagy te?",
              "next": "0503"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0503": {
          "id": "0503",
          "speaker": "Vadász",
          "text": "Én vagyok a vadász, aki az ebben a különleges ligetben rejtőző fajokra vadászik!",
          "buttons": [
            {
              "index": 1,
              "label": "Miért különleges ez a liget?",
              "next": "0504"
            },
            {
              "index": 2,
              "label": "Kérdezhetek valamit?",
              "next": "0505"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0504": {
          "id": "0504",
          "picture": "hunter-points-trees",
          "speaker": "Vadász",
          "text": "Nem tudom, de esküszöm, valami varázslatos rejtőzik ebben a ligetben. Nézd meg a fákat! Most pedig mennem kell!",
          "buttons": [
            {
              "index": 1,
              "label": "Viszlát",
              "next": "0506"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "START_TIMER",
              "raw": "5 minutes",
              "durationMs": 300000
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "grove_magic"
            }
          ],
          "condition": {}
        },
        "0505": {
          "id": "0505",
          "speaker": "Vadász",
          "text": "Igen, de lehet, hogy nem tudom a választ.",
          "buttons": [
            {
              "index": 1,
              "label": "Hogyan lehet bejutni a kastélyba?",
              "next": "0504"
            },
            {
              "index": 2,
              "label": "Hol van a kard?",
              "next": "0504"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0506": {
          "id": "0506",
          "picture": "hunter-points-fountain",
          "speaker": "Vadász",
          "text": "Szia megint! Egy Pina Coalát üldözök, nincs időm, de láttam valami csillogót a szökőkút kövei között.",
          "buttons": [
            {
              "index": 1,
              "label": "Viszlát",
              "next": "0507"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "START_TIMER",
              "raw": "5 minutes",
              "durationMs": 300000
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "fountain_shiny_object"
            }
          ],
          "condition": {}
        },
        "0507": {
          "id": "0507",
          "speaker": "Vadász",
          "text": "Szia, kalandor! Visszatértem a vadászatról, és most válaszolhatok néhány kérdésre, de előbb...",
          "buttons": [
            {
              "index": 1,
              "label": "Folytasd",
              "next": "0509"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0508": {
          "id": "0508",
          "speaker": "Vadász",
          "text": "A vadászt sehol sem látod.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0508"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0509": {
          "id": "0509",
          "picture": "hunter-points-footprints",
          "speaker": "Vadász",
          "text": "Látod azokat a kis lábnyomokat? Az a lény jobban tud rejtőzködni bárminél, amit valaha láttam. Talán valamelyik bokros helyen bújik, ahová én nem férek be!",
          "buttons": [
            {
              "index": 1,
              "label": "Folytasd",
              "next": "0510"
            }
          ],
          "actions": [
            {
              "type": "ADD_KNOWLEDGE",
              "data": "creature_in_bushes"
            }
          ],
          "condition": {}
        },
        "0510": {
          "id": "0510",
          "speaker": "Vadász",
          "text": "De most lássuk a kérdéseidet.",
          "buttons": [
            {
              "index": 1,
              "label": "Láttál valami furcsát?",
              "next": "0511"
            },
            {
              "index": 2,
              "label": "Ismersz itt valakit?",
              "next": "0512"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0511": {
          "id": "0511",
          "speaker": "Vadász",
          "text": "Nos, a hídnál furcsa faragásokat láttam a kövön, de semmi mást.",
          "buttons": [
            {
              "index": 1,
              "label": "Köszi",
              "next": "0514"
            }
          ],
          "actions": [
            {
              "type": "ADD_KNOWLEDGE",
              "data": "bridge_carvings"
            }
          ],
          "condition": {}
        },
        "0512": {
          "id": "0512",
          "speaker": "Vadász",
          "text": "Nos, láttad már a városi őrt? A barátom. Tud mesélni neked erről a kis birodalomról!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0513"
            }
          ],
          "actions": [
            {
              "type": "ADD_KNOWLEDGE",
              "data": "guard_knows_world"
            }
          ],
          "condition": {}
        },
        "0513": {
          "id": "0513",
          "picture": "hunter-gives-medal",
          "speaker": "Vadász",
          "text": "Ja, és kérlek, add oda ezt az aranymedált az őrnek! Talán ad érte valamit cserébe.",
          "buttons": [
            {
              "index": 1,
              "label": "Ennyi?",
              "next": "0514"
            }
          ],
          "actions": [
            {
              "type": "ADD_ITEM",
              "data": "Golden Medal"
            },
            {
              "type": "START_QUEST",
              "data": "Return Golden Medal to Guard"
            }
          ],
          "condition": {}
        },
        "0514": {
          "id": "0514",
          "speaker": "Vadász",
          "text": "Oké, és... Hallod azokat a farkasokat? Ez a vérhold éjszakája, mennem kell vadászni, ilyenkor a legjobb a préda!",
          "buttons": [
            {
              "index": 1,
              "label": "Viszlát",
              "next": "0508"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        }
      }
    },
    "06": {
      "defaultPicture": "goblin",
      "startPage": "0601",
      "pages": {
        "0601": {
          "id": "0601",
          "speaker": "Goblin",
          "text": "Szia, ki vagy? Én vagyok az erdőben élő goblin. Örülök, hogy találkoztunk.",
          "buttons": [
            {
              "index": 1,
              "label": "Szia!",
              "next": "0602"
            },
            {
              "index": 2,
              "label": "Vannak tárgyaid?",
              "next": "0603"
            },
            {
              "index": 3,
              "label": "Nézd, mim van",
              "next": "0604"
            }
          ],
          "actions": [],
          "condition": {
            "3": "save.inventory.includes(\"Mark of Goblins\")"
          }
        },
        "0602": {
          "id": "0602",
          "speaker": "Goblin",
          "text": "Szia, gyere velem! Hadd mutassam meg a gyűjteményemet!",
          "buttons": [
            {
              "index": 1,
              "label": "Talán legközelebb",
              "next": "0605"
            },
            {
              "index": 2,
              "label": "Oké",
              "next": "0606"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0603": {
          "id": "0603",
          "speaker": "Goblin",
          "text": "Igeeen. Határozottan. Van egy ritka tárgyakból álló gyűjteményem, amire elég büszke vagyok!",
          "buttons": [
            {
              "index": 1,
              "label": "Majd legközelebb megnézem",
              "next": "0605"
            },
            {
              "index": 2,
              "label": "Mutasd",
              "next": "0606"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0604": {
          "id": "0604",
          "speaker": "Goblin",
          "text": "Ó, nálad van a Goblinok jele. Hadd adjak neked valamit, barátom!",
          "buttons": [
            {
              "index": 1,
              "label": "Köszönöm!",
              "next": "0608"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0605": {
          "id": "0605",
          "speaker": "Goblin",
          "text": "Szia megint! Ezúttal megmutathatom a gyűjteményemet?",
          "buttons": [
            {
              "index": 1,
              "label": "Legközelebb",
              "next": "0605"
            },
            {
              "index": 2,
              "label": "Igen",
              "next": "0606"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0606": {
          "id": "0606",
          "picture": "goblin-items-on-ground",
          "speaker": "Goblin",
          "text": "Itt! Nézd, miket gyűjtöttem! Ha szeretnél egyet, csak szólj!",
          "buttons": [
            {
              "index": 1,
              "label": "Aranyérme",
              "next": "0607"
            },
            {
              "index": 2,
              "label": "Rubinkard",
              "next": "0609"
            },
            {
              "index": 3,
              "label": "Por",
              "next": "0610"
            },
            {
              "index": 4,
              "label": "Nem kell több",
              "next": "0616"
            }
          ],
          "actions": [],
          "condition": {
            "1": "!had_item.includes(\"Gold Coin\")",
            "2": "!had_item.includes(\"Ruby Sword\")",
            "3": "!had_item.includes(\"Strange Powder\")",
            "4": "[\"Strange Powder\", \"Ruby Sword\", \"Gold Coin\"].filter(item => had_item.includes(item)).length >= 2"
          }
        },
        "0607": {
          "id": "0607",
          "picture": "goblin-holds-gold-coin",
          "speaker": "Goblin",
          "text": "Ez egy aranyérme, amit az erdőben találtam. Elcserélném valamire, ami egy ritka állattól származik, például egy madártól.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké, viszlát",
              "next": "0605"
            },
            {
              "index": 2,
              "label": "Nálam van",
              "next": "0611"
            },
            {
              "index": 3,
              "label": "Mutasd a többi tárgyat",
              "next": "0606"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "goblin_gold_coin_trade"
            }
          ],
          "condition": {}
        },
        "0608": {
          "id": "0608",
          "picture": "goblin-holds-lucky-pebble",
          "speaker": "Goblin",
          "text": "Tessék! Vidd ezt a szerencsekavicsot.",
          "buttons": [
            {
              "index": 1,
              "label": "Köszi, viszlát",
              "next": "0605"
            },
            {
              "index": 2,
              "label": "Van valami másod?",
              "next": "0606"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "ADD_ITEM",
              "data": "Lucky Pebble"
            }
          ],
          "condition": {}
        },
        "0609": {
          "id": "0609",
          "picture": "goblin-holds-ruby-sword",
          "speaker": "Goblin",
          "text": "Ezt a rubinkardot a folyó fenekén találtam. Megláttam a rubinját, és muszáj volt megszereznem. Ha szeretnéd, adj érte valamilyen másik drágakövet.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké, viszlát",
              "next": "0605"
            },
            {
              "index": 2,
              "label": "Nálam van",
              "next": "0611"
            },
            {
              "index": 3,
              "label": "Mutasd a többi tárgyat",
              "next": "0606"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "goblin_ruby_sword_trade"
            }
          ],
          "condition": {}
        },
        "0610": {
          "id": "0610",
          "picture": "goblin-holds-powder-sack",
          "speaker": "Goblin",
          "text": "Hé, ezt a port egy bőrzsákban találtam, és olyan furcsának tűnt, hogy megtartottam. Elcserélném egy csillogóbb ékszerre.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké, viszlát",
              "next": "0605"
            },
            {
              "index": 2,
              "label": "Nálam van",
              "next": "0611"
            },
            {
              "index": 3,
              "label": "Mutasd a többi tárgyat",
              "next": "0606"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "goblin_powder_trade"
            }
          ],
          "condition": {}
        },
        "0611": {
          "id": "0611",
          "picture": "goblin-empty-hand",
          "speaker": "Goblin",
          "text": "Mutasd!",
          "buttons": [
            {
              "index": 1,
              "label": "Válassz tárgyat",
              "next": "0612"
            }
          ],
          "actions": [
            {
              "type": "DROPDOWN_INVENTORY",
              "options": [
                {
                  "value": "Silver Ring",
                  "label": "Ezüstgyűrű",
                  "next": "0612"
                },
                {
                  "value": "Crystal Shard",
                  "label": "Kristályszilánk",
                  "next": "0613"
                },
                {
                  "value": "Priclys Feather",
                  "label": "Priclys tolla",
                  "next": "0614"
                }
              ],
              "otherNext": "0615"
            }
          ],
          "condition": {}
        },
        "0612": {
          "id": "0612",
          "picture": "goblin-holds-powder-sack",
          "speaker": "Goblin",
          "text": "Itt a furcsa por. Szeretem a csillogó dolgokat, ember, például a port... A goblinoknak ez jó!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0605"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "REMOVE_ITEM",
              "data": "Silver Ring"
            },
            {
              "type": "ADD_ITEM",
              "data": "Strange Powder"
            }
          ],
          "condition": {}
        },
        "0613": {
          "id": "0613",
          "picture": "goblin-holds-ruby-sword",
          "speaker": "Goblin",
          "text": "Itt a rubinkard. Én jobban szeretem a kristályszilánkot: csillogóbb.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0605"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "REMOVE_ITEM",
              "data": "Crystal Shard"
            },
            {
              "type": "ADD_ITEM",
              "data": "Ruby Sword"
            }
          ],
          "condition": {}
        },
        "0614": {
          "id": "0614",
          "picture": "goblin-holds-gold-coin",
          "speaker": "Goblin",
          "text": "Itt az aranyérme. A toll az embereknek talán szemét, de a goblinoknak kincs!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0605"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "REMOVE_ITEM",
              "data": "Priclys Feather"
            },
            {
              "type": "ADD_ITEM",
              "data": "Gold Coin"
            }
          ],
          "condition": {}
        },
        "0615": {
          "id": "0615",
          "speaker": "Goblin",
          "text": "EZ nem kell!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0605"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0616": {
          "id": "0616",
          "picture": "goblin-holds-staff-of-goblins",
          "speaker": "Goblin",
          "text": "Adhatok még egy ajándékot, amiért ilyen remek kereskedőtársam vagy? Itt a Goblinbot. Ez azt jelenti, hogy a goblinok nagy barátja vagy.",
          "buttons": [
            {
              "index": 1,
              "label": "Köszi",
              "next": "0617"
            }
          ],
          "actions": [
            {
              "type": "ADD_ITEM",
              "data": "Staff of Goblins"
            }
          ],
          "condition": {}
        },
        "0617": {
          "id": "0617",
          "speaker": "Goblin",
          "text": "Most elmegyek, mert minden kincs itt már a zsebemben van!",
          "buttons": [
            {
              "index": 1,
              "label": "Viszlát",
              "next": "0618"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0618": {
          "id": "0618",
          "picture": "goblin-tent-by-tree",
          "speaker": "Goblin",
          "text": "A goblin elment minden értékével együtt.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0618"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        }
      }
    },
    "07": {
      "defaultPicture": "troll",
      "startPage": "0701",
      "pages": {
        "0701": {
          "id": "0701",
          "speaker": "Troll",
          "text": "Te át akarsz menni hídon?",
          "buttons": [
            {
              "index": 1,
              "label": "Igen",
              "next": "0702"
            },
            {
              "index": 2,
              "label": "Nem",
              "next": "0703"
            },
            {
              "index": 3,
              "label": "Mi??",
              "next": "0704"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0702": {
          "id": "0702",
          "speaker": "Troll",
          "text": "Előbb megold találós kérdés!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0705"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0703": {
          "id": "0703",
          "picture": "troll-blocks-bridge",
          "speaker": "Troll",
          "text": "Nem mehetsz át, ha nem megold találós kérdés. Én mond találós kérdés.",
          "buttons": [
            {
              "index": 1,
              "label": "Mondd el",
              "next": "0705"
            },
            {
              "index": 2,
              "label": "Hadd próbáljam meg",
              "next": "0701"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0704": {
          "id": "0704",
          "speaker": "Troll",
          "text": "Te buta!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0701"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0705": {
          "id": "0705",
          "speaker": "Troll",
          "text": "Első 6 betű: E, K, H, N, Ö, H... Mi következő 2?",
          "buttons": [
            {
              "index": 1,
              "label": "Választás",
              "next": "0706"
            }
          ],
          "actions": [
            {
              "type": "DROPDOWN_CHOICE",
              "options": [
                {
                  "label": "HN",
                  "next": "0706"
                },
                {
                  "label": "EK",
                  "next": "0704"
                },
                {
                  "label": "KH",
                  "next": "0704"
                },
                {
                  "label": "NH",
                  "next": "0704"
                },
                {
                  "label": "ÖH",
                  "next": "0704"
                },
                {
                  "label": "HE",
                  "next": "0704"
                }
              ]
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "troll_riddle"
            }
          ],
          "condition": {}
        },
        "0706": {
          "id": "0706",
          "picture": "troll-holds-key",
          "speaker": "Troll",
          "text": "Te okos! Itt hídkulcs. Most menj!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0707"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "ADD_ITEM",
              "data": "Bridge Key"
            }
          ],
          "condition": {}
        },
        "0707": {
          "id": "0707",
          "picture": "troll-sits-by-bridge",
          "speaker": "Troll",
          "text": "A Troll a híd szélén ül, és ügyet sem vet rád.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0707"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        }
      }
    },
    "08": {
      "defaultPicture": "fisherman",
      "startPage": "0801",
      "pages": {
        "0801": {
          "id": "0801",
          "speaker": "Horgász",
          "text": "Szia! Mit csinálsz a folyónál?",
          "buttons": [
            {
              "index": 1,
              "label": "Csak felfedezek",
              "next": "0803"
            },
            {
              "index": 2,
              "label": "A hidat keresem",
              "next": "0802"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0802": {
          "id": "0802",
          "picture": "fisherman-points-direction",
          "speaker": "Horgász",
          "text": "Sétálj pár métert, aztán fordulj jobbra; ott lesz a híd. Óvakodj a Trolltól! Egyébként tudnál segíteni valamiben?",
          "buttons": [
            {
              "index": 1,
              "label": "Persze",
              "next": "0804"
            },
            {
              "index": 2,
              "label": "Most nem",
              "next": "0805"
            }
          ],
          "actions": [
            {
              "type": "ADD_KNOWLEDGE",
              "data": "bridge_direction"
            }
          ],
          "condition": {}
        },
        "0803": {
          "id": "0803",
          "speaker": "Horgász",
          "text": "Menj a folyóhoz. A Troll megállít, de a találós kérdése nem olyan nehéz.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké, megyek",
              "next": "0805"
            },
            {
              "index": 2,
              "label": "Mit csinálsz itt?",
              "next": "0806"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0804": {
          "id": "0804",
          "picture": "fisherman-gives-rod",
          "speaker": "Horgász",
          "text": "Itt egy horgászbot. Fogd, és dobd be! Próbálj meg nagy lazacot fogni. Általában 20–25 másodperc után jönnek.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0807"
            },
            {
              "index": 2,
              "label": "Mit szólsz egy bluggyhalhoz?",
              "next": "0817"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "ADD_ITEM",
              "data": "Fishing Rod"
            },
            {
              "type": "START_QUEST",
              "data": "Get Great Salmon"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "great_salmon_time"
            }
          ],
          "condition": {}
        },
        "0805": {
          "id": "0805",
          "speaker": "Horgász",
          "text": "Akkor majd legközelebb találkozunk.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0808"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0806": {
          "id": "0806",
          "speaker": "Horgász",
          "text": "Türelmesen horgászom, próbálok nagy lazacot fogni, de ebben a sáros folyóban csak kis halakat találok.",
          "buttons": [
            {
              "index": 1,
              "label": "Segíthetek",
              "next": "0804"
            },
            {
              "index": 2,
              "label": "Ez szomorú",
              "next": "0809"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0807": {
          "id": "0807",
          "speaker": "Horgász",
          "text": "Nálad van a nagy lazac?",
          "buttons": [
            {
              "index": 1,
              "label": "Igen",
              "next": "0810"
            },
            {
              "index": 2,
              "label": "Nem",
              "next": "0811"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0808": {
          "id": "0808",
          "speaker": "Horgász",
          "text": "Szia, mi hozott ide?",
          "buttons": [
            {
              "index": 1,
              "label": "Csak felfedezek",
              "next": "0803"
            },
            {
              "index": 2,
              "label": "Segíteni akarok",
              "next": "0804"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0809": {
          "id": "0809",
          "speaker": "Horgász",
          "text": "Ezzel nem tudok mit kezdeni. Próbáld újra. Tudsz segíteni elkapni a prédát?",
          "buttons": [
            {
              "index": 1,
              "label": "Igen",
              "next": "0804"
            },
            {
              "index": 2,
              "label": "Nem",
              "next": "0805"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0810": {
          "id": "0810",
          "picture": "fisherman-empty-hand",
          "speaker": "Horgász",
          "text": "Akkor add ide.",
          "buttons": [
            {
              "index": 1,
              "label": "Válassz tárgyat",
              "next": "0812"
            }
          ],
          "actions": [
            {
              "type": "DROPDOWN_INVENTORY",
              "options": [
                {
                  "value": "Great Salmon",
                  "label": "Nagy lazac",
                  "next": "0812"
                }
              ],
              "otherNext": "0813"
            }
          ],
          "condition": {}
        },
        "0811": {
          "id": "0811",
          "speaker": "Horgász",
          "text": "Legyen nálad legközelebb!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0807"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0812": {
          "id": "0812",
          "speaker": "Horgász",
          "text": "Cserébe elmondhatom, hogy a Troll „E” betűje az „egy” szó kezdőbetűje.",
          "buttons": [
            {
              "index": 1,
              "label": "Köszi",
              "next": "0814"
            },
            {
              "index": 2,
              "label": "Segíthetek?",
              "next": "0815"
            }
          ],
          "actions": [
            {
              "type": "REMOVE_ITEM",
              "data": "Great Salmon"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "troll_o_means_one"
            }
          ],
          "condition": {}
        },
        "0813": {
          "id": "0813",
          "speaker": "Horgász",
          "text": "Ez nem a nagy lazac.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0811"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0814": {
          "id": "0814",
          "speaker": "Horgász",
          "text": "Szia-szia. Most pedig ne zavarj megint horgászás közben!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0816"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0815": {
          "id": "0815",
          "picture": "fisherman-gives-small-fish",
          "speaker": "Horgász",
          "text": "Nos... ha ezt odaadnád a Hírnöknek... és viszonzásképp kérlek, add oda neki ezeket a halakat. Talán elmond neked valamit.",
          "buttons": [
            {
              "index": 1,
              "label": "Odaadom neki",
              "next": "0814"
            }
          ],
          "actions": [
            {
              "type": "ADD_ITEM",
              "data": "Fish"
            },
            {
              "type": "START_QUEST",
              "data": "Give Fish to Messenger"
            }
          ],
          "condition": {}
        },
        "0816": {
          "id": "0816",
          "picture": "fisherman-sits-on-dock",
          "speaker": "Horgász",
          "text": "A horgász integet neked, majd az ujját a szája elé teszi: „pszt”. Most nem tudsz vele beszélni.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0816"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0817": {
          "id": "0817",
          "speaker": "Horgász",
          "text": "A bluggyhal általában 12–15 másodperc után akad horogra.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké, köszi",
              "next": "0807"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "blobfish_time"
            }
          ],
          "condition": {}
        }
      }
    },
    "09": {
      "defaultPicture": "messenger",
      "requiredArea": "CASTLE_SIDE",
      "startPage": "0901",
      "pages": {
        "0901": {
          "id": "0901",
          "speaker": "Hírnök",
          "text": "Szia, én vagyok a hírnök. Folyton úton vagyok, és üzeneteket viszek különböző embereknek.",
          "buttons": [
            {
              "index": 1,
              "label": "Miért nem futsz?",
              "next": "0902"
            },
            {
              "index": 2,
              "label": "Adhatok neked valamit?",
              "next": "0903"
            },
            {
              "index": 3,
              "label": "Segítség kell?",
              "next": "0904"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0902": {
          "id": "0902",
          "speaker": "Hírnök",
          "text": "Hé, nem, utálok futni. Soha nem futnék. Na, ha van valami fontos...",
          "buttons": [
            {
              "index": 1,
              "label": "Adhatok neked valamit?",
              "next": "0903"
            },
            {
              "index": 2,
              "label": "Kell a segítségem?",
              "next": "0904"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0903": {
          "id": "0903",
          "picture": "messenger-open-gloved-hands",
          "speaker": "Hírnök",
          "text": "Akkor add ide.",
          "buttons": [
            {
              "index": 1,
              "label": "Válassz tárgyat",
              "next": "0905"
            }
          ],
          "actions": [
            {
              "type": "DROPDOWN_INVENTORY",
              "options": [
                {
                  "value": "Bundle of Letters",
                  "label": "Levélköteg",
                  "next": "0905"
                },
                {
                  "value": "Fish",
                  "label": "Hal",
                  "next": "0907"
                }
              ],
              "otherNext": "0913"
            }
          ],
          "condition": {}
        },
        "0904": {
          "id": "0904",
          "speaker": "Hírnök",
          "text": "Nos... elvesztettem — hadd számoljam meg — három üzenetet a híd kastély felőli végén. Elejtettem őket. Ha visszahoznád, nagyon örülnék.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké, megcsinálom",
              "next": "0906"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "START_QUEST",
              "data": "Lost Messages"
            }
          ],
          "condition": {}
        },
        "0905": {
          "id": "0905",
          "picture": "messenger-delighted-letters",
          "speaker": "Hírnök",
          "text": "Ó, köszönöm!!! Cserébe elmondom a jelszó első részét.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0911"
            }
          ],
          "actions": [
            {
              "type": "REMOVE_ITEM",
              "data": "Bundle of Letters"
            },
            {
              "type": "COMPLETE_QUEST",
              "data": "Lost Messages"
            }
          ],
          "condition": {}
        },
        "0906": {
          "id": "0906",
          "speaker": "Hírnök",
          "text": "Nálad vannak azok a levelek?",
          "buttons": [
            {
              "index": 1,
              "label": "Igen",
              "next": "0908"
            },
            {
              "index": 2,
              "label": "Nem",
              "next": "0909"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0907": {
          "id": "0907",
          "picture": "messenger-delighted-fish",
          "speaker": "Hírnök",
          "text": "Óóó, a Horgász küldte nekem ezeket a halakat? Remek. Cserébe elmondom: ha valaha furcsa szavakat találsz egy papíron, használj megfejtőport, ami csak egy szürke por. Most pedig mennem kell.",
          "buttons": [
            {
              "index": 1,
              "label": "Viszlát",
              "next": "0910"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "REMOVE_ITEM",
              "data": "Fish"
            },
            {
              "type": "COMPLETE_QUEST",
              "data": "Give Fish to Messenger"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "decoder_powder"
            }
          ],
          "condition": {}
        },
        "0908": {
          "id": "0908",
          "speaker": "Hírnök",
          "text": "Kérlek, add ide őket. Tényleg szükségem van rájuk.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0903"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "0909": {
          "id": "0909",
          "speaker": "Hírnök",
          "text": "Akkor miért jöttél vissza? Sietek. Csak akkor gyere vissza, ha nálad vannak azok a levelek.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0906"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0910": {
          "id": "0910",
          "speaker": "Hírnök",
          "text": "Szia, akarsz segíteni nekem valamiben?",
          "buttons": [
            {
              "index": 1,
              "label": "Nem",
              "next": "0910"
            },
            {
              "index": 2,
              "label": "Igen",
              "next": "0904"
            },
            {
              "index": 3,
              "label": "Adni akarok neked valamit",
              "next": "0903"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0911": {
          "id": "0911",
          "speaker": "Hírnök",
          "text": "A jelszó első része „Almás”, most pedig mennem kell!",
          "buttons": [
            {
              "index": 1,
              "label": "Köszi",
              "next": "0912"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "password_first_part"
            }
          ],
          "condition": {}
        },
        "0912": {
          "id": "0912",
          "speaker": "Hírnök",
          "text": "Nem látod a Hírnököt.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0912"
            },
            {
              "index": 2,
              "label": "Kiálts utána",
              "next": "0914"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0913": {
          "id": "0913",
          "speaker": "Hírnök",
          "text": "Nem erre van szükségem.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "0906"
            }
          ],
          "actions": [
            {
              "type": "NEXT_SCAN"
            }
          ],
          "condition": {}
        },
        "0914": {
          "id": "0914",
          "speaker": "Hírnök",
          "text": "Pár perc múlva a Hírnök visszajön. Kicsit mérges, de örül, hogy lát.",
          "buttons": [
            {
              "index": 1,
              "label": "Adni akarok neked valamit",
              "next": "0903"
            }
          ],
          "actions": []
        }
      }
    }
  },
  "items": {
    "Sweets": {
      "defaultPicture": "sweets",
      "displayName": "Édesség",
      "startPage": "1101",
      "pages": {
        "1101": {
          "id": "1101",
          "speaker": "Édesség",
          "text": "Ezek csak édességek.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            },
            {
              "index": 2,
              "label": "Edd meg",
              "next": "1102"
            },
            {
              "index": 3,
              "label": "Edd meg",
              "next": "1103"
            }
          ],
          "actions": [
            {
              "type": "ADD_COUNTER",
              "data": "eatAttempts",
              "amount": 1,
              "buttonIndex": 2
            },
            {
              "type": "ADD_COUNTER",
              "data": "eatAttempts",
              "amount": 1,
              "buttonIndex": 3
            }
          ],
          "condition": {
            "2": "counter(\"eatAttempts\") < 4",
            "3": "counter(\"eatAttempts\") >= 4"
          }
        },
        "1102": {
          "id": "1102",
          "speaker": "Édesség",
          "text": "Egy kis figyelmeztetés: NE!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "1103": {
          "id": "1103",
          "speaker": "Édesség",
          "text": "Tényleg megetted. Most elvesztettél egy értékes erőforrást...\n\nRemek...",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [
            {
              "type": "REMOVE_ITEM",
              "data": "Sweets"
            }
          ],
          "condition": {}
        }
      }
    },
    "Old Scroll": {
      "defaultPicture": "old-scroll",
      "displayName": "Régi tekercs",
      "startPage": "1201",
      "pages": {
        "1201": {
          "id": "1201",
          "speaker": "Régi tekercs",
          "text": "Csak egy régi tekercs, összehajtva!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            },
            {
              "index": 2,
              "label": "Megvizsgálás",
              "next": "1202"
            },
            {
              "index": 3,
              "label": "Hajtsd ki",
              "next": "1203"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "1202": {
          "id": "1202",
          "speaker": "Régi tekercs",
          "text": "A papírja nagyon réginek tűnik, és egy kicsit koszos.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            },
            {
              "index": 2,
              "label": "Hajtsd ki",
              "next": "1203"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "1203": {
          "id": "1203",
          "speaker": "Régi tekercs",
          "text": "Kihajtod, és egy furcsa feliratot találsz rajta:\n\nRcuuygtf:Crrmgrkg",
          "buttons": [
            {
              "index": 1,
              "label": "Vizsgáld meg a papírt",
              "next": "1202"
            },
            {
              "index": 2,
              "label": "Olvasd fel",
              "next": "1204"
            },
            {
              "index": 3,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [
            {
              "type": "ADD_KNOWLEDGE",
              "data": "encoded_scroll"
            }
          ],
          "condition": {}
        },
        "1204": {
          "id": "1204",
          "speaker": "Régi tekercs",
          "text": "Összevissza kezdesz beszélni, de semmi különös nem történik, azon kívül, hogy úgy nézel ki, mint aki elvesztette az eszét.",
          "buttons": [
            {
              "index": 1,
              "label": "Kombináld egy tárggyal",
              "next": "1205"
            },
            {
              "index": 2,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "1205": {
          "id": "1205",
          "speaker": "Régi tekercs",
          "text": "Válassz egy tárgyat a felszerelésedből:",
          "buttons": [
            {
              "index": 1,
              "label": "Válassz tárgyat",
              "next": "1207"
            }
          ],
          "actions": [
            {
              "type": "DROPDOWN_INVENTORY",
              "options": [
                {
                  "value": "Strange Powder",
                  "label": "Furcsa por",
                  "next": "1207"
                }
              ],
              "otherNext": "1206"
            }
          ],
          "condition": {}
        },
        "1206": {
          "id": "1206",
          "speaker": "Régi tekercs",
          "text": "Semmi sem történik.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "1207": {
          "id": "1207",
          "speaker": "Régi tekercs",
          "text": "A szavak csillogni kezdenek, a varázspor pedig porrá válik és elpárolog. Alatta új szavakat találsz.\n\nJelszó: Almás pite",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [
            {
              "type": "ADD_ITEM",
              "data": "Scroll with Password"
            },
            {
              "type": "REMOVE_ITEM",
              "data": "Old Scroll"
            },
            {
              "type": "REMOVE_ITEM",
              "data": "Strange Powder"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "castle_password"
            }
          ],
          "condition": {}
        }
      }
    },
    "Magic Branch": {
      "defaultPicture": "magic-branch",
      "displayName": "Varázság",
      "startPage": "1301",
      "pages": {
        "1301": {
          "id": "1301",
          "speaker": "Varázság",
          "text": "Ez egy ág, amit egy beszélő fától kaptál.",
          "buttons": [
            {
              "index": 1,
              "label": "Suhints vele",
              "next": "1302"
            },
            {
              "index": 2,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "1302": {
          "id": "1302",
          "speaker": "Varázság",
          "text": "Szivárványszínű csillámok jelennek meg, de semmi más nem változik.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        }
      }
    },
    "Horn of Trees": {
      "defaultPicture": "horn-of-trees",
      "displayName": "A fák kürtje",
      "startPage": "1401",
      "pages": {
        "1401": {
          "id": "1401",
          "speaker": "A fák kürtje",
          "text": "Ezt a furcsa kürtöt a fától kaptad. Olyan, mint egy hangszer.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            },
            {
              "index": 2,
              "label": "Fújd meg",
              "next": "1402"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "1402": {
          "id": "1402",
          "speaker": "A fák kürtje",
          "text": "Amikor megfújod, száraz levelek susogásához hasonló hangot hallasz, majd a fa megszólal.",
          "buttons": [
            {
              "index": 1,
              "label": "Halljuk",
              "next": "0410"
            }
          ],
          "actions": [],
          "condition": {}
        }
      },
      "crossEncounterTargets": [
        "0410"
      ]
    },
    "Bridge Key": {
      "defaultPicture": "bridge-key",
      "displayName": "Hídkulcs",
      "startPage": "1501",
      "pages": {
        "1501": {
          "id": "1501",
          "speaker": "Hídkulcs",
          "text": "Egy ezüstkulcs. Ki tudod nyitni vele a hidat.",
          "buttons": [
            {
              "index": 1,
              "label": "Használd",
              "next": "1502"
            },
            {
              "index": 2,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "1502": {
          "id": "1502",
          "speaker": "Hídkulcs",
          "text": "Most már nyitva van a híd, és elérheted a Kastélybejárat területét.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [
            {
              "type": "UNLOCK_AREA",
              "data": "CASTLE_SIDE"
            }
          ],
          "condition": {}
        }
      }
    },
    "Golden Medal": {
      "defaultPicture": "golden-medal",
      "displayName": "Aranymedál",
      "startPage": "1601",
      "pages": {
        "1601": {
          "id": "1601",
          "speaker": "Aranymedál",
          "text": "Egy selyemzsinórra kötött aranymedál. A vadász adta neked, hogy add oda a barátjának, az őrnek, a barátság jeleként.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            },
            {
              "index": 2,
              "label": "Add oda az őrnek",
              "next": "1602"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "1602": {
          "id": "1602",
          "speaker": "Aranymedál",
          "text": "Akkor menj az őrhöz!!!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        }
      }
    },
    "Mark of Goblins": {
      "defaultPicture": "mark-of-goblins",
      "displayName": "Goblinok jele",
      "startPage": "1701",
      "pages": {
        "1701": {
          "id": "1701",
          "speaker": "Goblinok jele",
          "text": "Egy kis fa korong, amelybe goblinarcot véstek. Az őr szerint ez lenyűgözi a goblinokat.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        }
      }
    },
    "Priclys Feather": {
      "defaultPicture": "priclys-feather",
      "displayName": "Priclys tolla",
      "startPage": "1801",
      "pages": {
        "1801": {
          "id": "1801",
          "speaker": "Priclys tolla",
          "text": "Egy sárgásbarna, fehér pettyes toll. Valamilyen különös lénytől származhat.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            },
            {
              "index": 2,
              "label": "Lengesd meg",
              "next": "1802"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "1802": {
          "id": "1802",
          "speaker": "Priclys tolla",
          "text": "Szárnycsapások halk suhogását hallod, aztán a hang lassan elhal.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        }
      }
    },
    "Strange Powder": {
      "defaultPicture": "strange-powder",
      "displayName": "Furcsa por",
      "startPage": "1901",
      "pages": {
        "1901": {
          "id": "1901",
          "speaker": "Furcsa por",
          "text": "Ez a por tényleg furcsa. Megpróbálhatnád beledörzsölni valamibe, mert varázslatosnak tűnik.",
          "buttons": [
            {
              "index": 1,
              "label": "Most nem",
              "next": "HOME"
            },
            {
              "index": 2,
              "label": "Próbáld meg",
              "next": "1902"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "1902": {
          "id": "1902",
          "speaker": "Furcsa por",
          "text": "Mibe?",
          "buttons": [
            {
              "index": 1,
              "label": "Válassz tárgyat",
              "next": "1903"
            }
          ],
          "actions": [
            {
              "type": "DROPDOWN_INVENTORY",
              "options": [
                {
                  "value": "Old Scroll",
                  "label": "Régi tekercs",
                  "next": "1903"
                }
              ],
              "otherNext": "1904"
            }
          ],
          "condition": {}
        },
        "1903": {
          "id": "1903",
          "speaker": "Furcsa por",
          "text": "Amikor beledörzsölöd a régi papírba, csillogni kezd, és új szöveg jelenik meg rajta. Jelszó: „almás pite”. Megszerezted valamihez a jelszót.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [
            {
              "type": "ADD_ITEM",
              "data": "Scroll with Password"
            },
            {
              "type": "REMOVE_ITEM",
              "data": "Old Scroll"
            },
            {
              "type": "REMOVE_ITEM",
              "data": "Strange Powder"
            },
            {
              "type": "ADD_KNOWLEDGE",
              "data": "castle_password"
            }
          ],
          "condition": {}
        },
        "1904": {
          "id": "1904",
          "speaker": "Furcsa por",
          "text": "Semmi sem történik.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        }
      }
    },
    "Gold Coin": {
      "defaultPicture": "gold-coin",
      "displayName": "Aranyérme",
      "startPage": "2001",
      "pages": {
        "2001": {
          "id": "2001",
          "speaker": "Aranyérme",
          "text": "Egy aranyérme, amit a goblinnál találtál. Kereskedésre használható.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        }
      }
    },
    "Ruby Sword": {
      "defaultPicture": "ruby-sword",
      "displayName": "Rubinkard",
      "startPage": "2101",
      "pages": {
        "2101": {
          "id": "2101",
          "speaker": "Rubinkard / Koji kardja",
          "text": "A penge nagyon ősi és különleges. Örülsz, hogy a goblintól kaptad.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            },
            {
              "index": 2,
              "label": "Gyakorolj",
              "next": "2102"
            },
            {
              "index": 3,
              "label": "Dobd el",
              "next": "2103"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "2102": {
          "id": "2102",
          "speaker": "Rubinkard / Koji kardja",
          "text": "Amikor úgy fogod, mint egy kardforgató, hatalmas erőt érzel az ereidben. Kipróbálsz néhány bonyolult mozdulatot. Meglepően könnyűek. Nagyon jó harcossá váltál.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "2103": {
          "id": "2103",
          "speaker": "Rubinkard / Koji kardja",
          "text": "Amikor eldobod, bumerángként visszatér hozzád. Ez valamilyen varázsfegyvernek tűnik.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        }
      },
      "aliases": [
        "Sword of Koji"
      ]
    },
    "Staff of Goblins": {
      "defaultPicture": "staff-of-goblins",
      "displayName": "Goblinbot",
      "startPage": "2201",
      "pages": {
        "2201": {
          "id": "2201",
          "speaker": "Goblinbot",
          "text": "Ez a fából és aranyból készült bot, amit egy goblintól kaptál, a barátság jelképe.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            },
            {
              "index": 2,
              "label": "Taposs rá",
              "next": "2202"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "2202": {
          "id": "2202",
          "speaker": "Goblinbot",
          "text": "Rátaposol. Egy távolodó goblinkacajt hallasz, aztán csend lesz.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        }
      }
    },
    "Fishing Rod": {
      "defaultPicture": "fishing-rod",
      "displayName": "Horgászbot",
      "startPage": "2301",
      "pages": {
        "2301": {
          "id": "2301",
          "speaker": "Horgászbot",
          "text": "Csak egy horgászbot egy kis úszóval.",
          "buttons": [
            {
              "index": 1,
              "label": "Dobd be",
              "next": "2302"
            },
            {
              "index": 2,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "2302": {
          "id": "2302",
          "speaker": "Horgászbot",
          "text": "Bedobod, és vársz két-három másodpercet.",
          "buttons": [
            {
              "index": 1,
              "label": "Húzd ki",
              "next": "2310"
            },
            {
              "index": 2,
              "label": "Várj",
              "next": "2303"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "2303": {
          "id": "2303",
          "speaker": "Horgászbot",
          "text": "Vársz négy-öt másodpercet.",
          "buttons": [
            {
              "index": 1,
              "label": "Húzd ki",
              "next": "2310"
            },
            {
              "index": 2,
              "label": "Várj",
              "next": "2304"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "2304": {
          "id": "2304",
          "speaker": "Horgászbot",
          "text": "Vársz hat-hét másodpercet.",
          "buttons": [
            {
              "index": 1,
              "label": "Húzd ki",
              "next": "2311"
            },
            {
              "index": 2,
              "label": "Húzd ki",
              "next": "2310"
            },
            {
              "index": 3,
              "label": "Várj",
              "next": "2305"
            }
          ],
          "actions": [
            {
              "type": "SET_COUNTER",
              "data": "blobfishCaught",
              "value": 1,
              "buttonIndex": 1
            }
          ],
          "condition": {
            "1": "counter(\"blobfishCaught\") < 1",
            "2": "counter(\"blobfishCaught\") >= 1"
          }
        },
        "2305": {
          "id": "2305",
          "speaker": "Horgászbot",
          "text": "Vársz három-négy másodpercet.",
          "buttons": [
            {
              "index": 1,
              "label": "Húzd ki",
              "next": "2310"
            },
            {
              "index": 2,
              "label": "Várj",
              "next": "2306"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "2306": {
          "id": "2306",
          "speaker": "Horgászbot",
          "text": "Vársz három másodpercet.",
          "buttons": [
            {
              "index": 1,
              "label": "Húzd ki",
              "next": "2310"
            },
            {
              "index": 2,
              "label": "Várj",
              "next": "2307"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "2307": {
          "id": "2307",
          "speaker": "Horgászbot",
          "text": "Vársz két-három másodpercet.",
          "buttons": [
            {
              "index": 1,
              "label": "Húzd ki",
              "next": "2312"
            },
            {
              "index": 2,
              "label": "Húzd ki",
              "next": "2310"
            },
            {
              "index": 3,
              "label": "Várj",
              "next": "2308"
            }
          ],
          "actions": [
            {
              "type": "SET_COUNTER",
              "data": "salmonCaught",
              "value": 1,
              "buttonIndex": 1
            }
          ],
          "condition": {
            "1": "counter(\"salmonCaught\") < 1",
            "2": "counter(\"salmonCaught\") >= 1"
          }
        },
        "2308": {
          "id": "2308",
          "speaker": "Horgászbot",
          "text": "Vársz négy-hat másodpercet.",
          "buttons": [
            {
              "index": 1,
              "label": "Húzd ki",
              "next": "2310"
            },
            {
              "index": 2,
              "label": "Várj",
              "next": "2309"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "2309": {
          "id": "2309",
          "speaker": "Horgászbot",
          "text": "Vársz még egy másodpercet.",
          "buttons": [
            {
              "index": 1,
              "label": "Húzd ki",
              "next": "2313"
            },
            {
              "index": 2,
              "label": "Húzd ki",
              "next": "2310"
            }
          ],
          "actions": [
            {
              "type": "SET_COUNTER",
              "data": "bootsCaught",
              "value": 1,
              "buttonIndex": 1
            }
          ],
          "condition": {
            "1": "counter(\"bootsCaught\") < 1",
            "2": "counter(\"bootsCaught\") >= 1"
          }
        },
        "2310": {
          "id": "2310",
          "speaker": "Horgászbot",
          "text": "Semmi. Nem fogtál semmit. Most pedig menj el.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "2311": {
          "id": "2311",
          "speaker": "Horgászbot",
          "text": "Küszködsz a behúzással, és a végén egy bluggyhal lóg a horgon.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [
            {
              "type": "ADD_ITEM",
              "data": "Blobfish"
            }
          ],
          "condition": {}
        },
        "2312": {
          "id": "2312",
          "speaker": "Horgászbot",
          "text": "Elkezded behúzni. Küszködsz, aztán ta-daa: egy nagy lazac van rajta.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [
            {
              "type": "ADD_ITEM",
              "data": "Great Salmon"
            },
            {
              "type": "COMPLETE_QUEST",
              "data": "Get Great Salmon"
            }
          ],
          "condition": {}
        },
        "2313": {
          "id": "2313",
          "speaker": "Horgászbot",
          "text": "Egy régi csizmát találsz.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [
            {
              "type": "ADD_ITEM",
              "data": "Old Boots"
            }
          ],
          "condition": {}
        }
      }
    },
    "Crystal Shard": {
      "defaultPicture": "crystal-shard",
      "displayName": "Kristályszilánk",
      "startPage": "2401",
      "pages": {
        "2401": {
          "id": "2401",
          "speaker": "Kristályszilánk",
          "text": "Egy kék kristályszilánk. Ha a fény felé tartod, a fényt szivárványszínekre bontja.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        }
      }
    },
    "Blobfish": {
      "defaultPicture": "blobfish",
      "displayName": "Bluggyhal",
      "startPage": "2501",
      "pages": {
        "2501": {
          "id": "2501",
          "speaker": "Bluggyhal",
          "text": "Pont úgy néz ki, mint egy leeresztett labda.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            },
            {
              "index": 2,
              "label": "Fújd fel",
              "next": "2502"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "2502": {
          "id": "2502",
          "speaker": "Bluggyhal",
          "text": "Sokáig küszködsz és próbálkozol, de nem sikerül. Végül feladod.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        }
      }
    },
    "Silver Ring": {
      "defaultPicture": "silver-ring",
      "displayName": "Ezüstgyűrű",
      "startPage": "2601",
      "pages": {
        "2601": {
          "id": "2601",
          "speaker": "Ezüstgyűrű",
          "text": "Gyönyörű, fényesen csillogó gyűrű, amit a folyónál találtál.",
          "buttons": [
            {
              "index": 1,
              "label": "Vedd fel.",
              "next": "2602"
            },
            {
              "index": 2,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [
            {
              "type": "SET_COUNTER",
              "data": "worn",
              "value": 1,
              "buttonIndex": 1
            }
          ],
          "condition": {
            "1": "counter(\"worn\") < 1"
          }
        },
        "2602": {
          "id": "2602",
          "speaker": "Ezüstgyűrű",
          "text": "Felveszed az ujjadra, és jól néz ki az ezüstös csillogásával.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        }
      }
    },
    "Bundle of Letters": {
      "defaultPicture": "bundle-of-letters",
      "displayName": "Levélköteg",
      "startPage": "2701",
      "pages": {
        "2701": {
          "id": "2701",
          "speaker": "Levélköteg",
          "text": "Egy köteg levél, amit a hídnál találtál. Valaki elejthette.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        }
      }
    },
    "Scroll with Password": {
      "defaultPicture": "scroll-with-password",
      "displayName": "Tekercs a jelszóval",
      "startPage": "2801",
      "pages": {
        "2801": {
          "id": "2801",
          "speaker": "Tekercs a jelszóval",
          "text": "Csak a régi tekercs, de megfejtve.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            },
            {
              "index": 2,
              "label": "Vizsgáld meg",
              "next": "2802"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "2802": {
          "id": "2802",
          "speaker": "Tekercs a jelszóval",
          "text": "A papíron ez áll: „jelszó: almás pite.” Vajon hol kellene használnod?",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [
            {
              "type": "ADD_KNOWLEDGE",
              "data": "castle_password"
            }
          ],
          "condition": {}
        }
      }
    },
    "Old Boots": {
      "defaultPicture": "old-boots",
      "displayName": "Régi csizma",
      "startPage": "2901",
      "pages": {
        "2901": {
          "id": "2901",
          "speaker": "Régi csizma",
          "text": "Csak egy pár elnyűtt bőrcsizma. Még mindig csöpög belőle a víz.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            },
            {
              "index": 2,
              "label": "Vedd fel",
              "next": "2902"
            }
          ],
          "actions": [],
          "condition": {}
        },
        "2902": {
          "id": "2902",
          "speaker": "Régi csizma",
          "text": "Felveszed, de annyira vizes és kényelmetlen, hogy azonnal le is veszed.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        }
      }
    },
    "Great Salmon": {
      "defaultPicture": "great-salmon",
      "displayName": "Nagy lazac",
      "startPage": "3001",
      "pages": {
        "3001": {
          "id": "3001",
          "speaker": "Nagy lazac",
          "text": "Csak egy nagy hal. Várj… még mindig él!",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        }
      }
    },
    "Fish": {
      "defaultPicture": "fish",
      "displayName": "Hal",
      "startPage": "3101",
      "pages": {
        "3101": {
          "id": "3101",
          "speaker": "Hal",
          "text": "Ezek csak halak egy zsákban.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        }
      }
    },
    "Lucky Pebble": {
      "defaultPicture": "lucky-pebble",
      "displayName": "Szerencsekavics",
      "startPage": "3201",
      "pages": {
        "3201": {
          "id": "3201",
          "speaker": "Szerencsekavics",
          "text": "Egy kis kavics, ami mintha szerencsét hozna.",
          "buttons": [
            {
              "index": 1,
              "label": "Oké",
              "next": "HOME"
            }
          ],
          "actions": [],
          "condition": {}
        }
      }
    },
    "Straw": {
      "displayName": "Szalma",
      "startPage": "3601",
      "implemented": false,
      "pages": {}
    },
    "Mosquito": {
      "displayName": "Szúnyog",
      "startPage": "3701",
      "implemented": false,
      "pages": {}
    },
    "Sketch3": {
      "displayName": "Vázlat3",
      "startPage": "3801",
      "implemented": false,
      "pages": {}
    },
    "Golden Apple": {
      "displayName": "Aranyalma",
      "startPage": "3901",
      "implemented": false,
      "pages": {}
    }
  },
  "knowledgeFolders": {
    "merchant": "Kereskedő",
    "castle": "Kastély",
    "troll": "Troll",
    "world": "Világ és területek",
    "goblins": "Goblinok",
    "messenger": "Hírnök",
    "warrior": "Harcos",
    "grove": "Liget",
    "bridge": "Híd",
    "fishing": "Horgászat",
    "password": "Jelszó"
  },
  "thingsIKnow": {
    "sweets_from_merchant": {
      "text": "Édességet a Kereskedőtől lehet venni.",
      "folder": "merchant"
    },
    "password_ending_pie": {
      "text": "A jelszó vége valószínűleg \"pite\".",
      "folder": "castle"
    },
    "troll_letters_are_numbers": {
      "text": "A Troll rejtvényében a betűk valahogyan számokhoz kapcsolódnak.",
      "folder": "troll"
    },
    "village_centre": {
      "text": "A Faluközpont a világ egyik fő területe.",
      "folder": "world"
    },
    "other_world_sections": {
      "text": "A többi terület a Liget, a Híd és a Kastélybejárat.",
      "folder": "world"
    },
    "castle_guarded_by_troll": {
      "text": "A Kastélybejárat felé vezető utat egy Troll őrzi.",
      "folder": "troll"
    },
    "troll_blocks_castle": {
      "text": "A Trollt le kell győzni, mielőtt elérheted a Kastélybejáratot.",
      "folder": "troll"
    },
    "mark_of_goblins": {
      "text": "A goblinok barátságosabbak lesznek, ha megmutatod nekik a Goblinok jelét.",
      "folder": "goblins"
    },
    "messenger_personality": {
      "text": "A Hírnök nagyon szereti az édességet, és utál futni.",
      "folder": "messenger"
    },
    "warrior_weakness": {
      "text": "A Harcost csak Koji kardjával lehet legyőzni.",
      "folder": "warrior"
    },
    "grove_magic": {
      "text": "Valami mágikus dolog rejtőzhet a Ligetben. Érdemes megnézni a fákat.",
      "folder": "grove"
    },
    "fountain_shiny_object": {
      "text": "A Vadász valami fényes dolgot látott a szökőkút kövei között.",
      "folder": "grove"
    },
    "creature_in_bushes": {
      "text": "Egy különös lény valamelyik bokros helyen rejtőzhet.",
      "folder": "grove"
    },
    "bridge_carvings": {
      "text": "Furcsa faragások vannak a Híd köveiben.",
      "folder": "bridge"
    },
    "guard_knows_world": {
      "text": "A városi Őr sok mindent tud erről a kis birodalomról.",
      "folder": "world"
    },
    "goblin_gold_coin_trade": {
      "text": "A Goblin az aranyérmét egy ritka állattól származó dologért adná, például valami madártól származóért.",
      "folder": "goblins"
    },
    "goblin_ruby_sword_trade": {
      "text": "A Goblin a rubinkardot egy másik drágakőért adná.",
      "folder": "goblins"
    },
    "goblin_powder_trade": {
      "text": "A Goblin a furcsa port egy fényes ékszerért adná.",
      "folder": "goblins"
    },
    "troll_riddle": {
      "text": "A Troll rejtvénye: \"E, K, H, N, Ö, H... Mi a következő két betű?\"",
      "folder": "troll"
    },
    "bridge_direction": {
      "text": "A Halásztól a Híd néhány méterre van, jobbra.",
      "folder": "bridge"
    },
    "great_salmon_time": {
      "text": "A nagy lazac általában körülbelül 20–25 másodperc után harap.",
      "folder": "fishing"
    },
    "troll_o_means_one": {
      "text": "A Troll rejtvényében az \"E\" az \"Egy\" szó kezdőbetűje.",
      "folder": "troll"
    },
    "blobfish_time": {
      "text": "A bluggyhal általában körülbelül 12–15 másodperc után harap.",
      "folder": "fishing"
    },
    "decoder_powder": {
      "text": "A papírra írt furcsa szavakat egy szürke dekódoló por segítségével lehet megfejteni.",
      "folder": "castle"
    },
    "password_first_part": {
      "text": "A kastély jelszavának első része \"Almás\".",
      "folder": "castle"
    },
    "castle_requires_password": {
      "text": "A Kastélyba való bejutáshoz jelszó szükséges.",
      "folder": "castle"
    },
    "encoded_scroll": {
      "text": "A régi tekercsen ez a furcsa szöveg található: \"Rcuuygtf:Crrmgrkg\".",
      "folder": "castle"
    },
    "castle_password": {
      "text": "A Kastély jelszava: \"Almás pite\".",
      "folder": "castle"
    },
    "Password1": {
      "text": "A jelszó 1. része: \"7\".",
      "folder": "password"
    },
    "Password2": {
      "text": "A jelszó 2. része: \"891\".",
      "folder": "password"
    },
    "Password3": {
      "text": "A jelszó 3. része: \"011\".",
      "folder": "password"
    }
  },
  "compilerNotes": [
    "PASSWORD_INPUT from the source spreadsheet is normalized to DROPDOWN_CHOICE.",
    "Item dialogues use the same page/button/action/condition shape as NPC encounters.",
    "Item dialogue buttons use next='HOME' when the design says the player returns Home.",
    "Blobfish replaces Pufferfish everywhere per the current item canon.",
    "Message Paper is normalized to Bundle of Letters per the current item canon.",
    "Staff of Goblin is normalized to Staff of Goblins per the current item canon.",
    "Magic Branch on Warrior page 1002 links to the already-existing failed rainbow-sparkle page 1010.",
    "UNLOCK_AREA is represented for Bridge Key and requires an app action handler.",
    "Horn of Trees intentionally links to NPC page 0410.",
    "Objective fixes: Buy Sweets and Get Great Salmon now complete at their actual completion points.",
    "Added side objectives for the Merchant's Blobfish request and returning the Golden Medal to the Guard.",
    "Lost Messages now completes only after Bundle of Letters is actually handed to the Messenger.",
    "Guard page 0307 now provides a route to the Golden Medal hand-in pages 0308-0310.",
    "Removed duplicate Gold Coin reward from Goblin page 0604; the reward remains on page 0608.",
    "Bridge Key now unlocks internal area id CASTLE_SIDE to match encounters 09 and 10.",
    "Warrior page 1002 now uses DROPDOWN_INVENTORY so unavailable items cannot be selected.",
    "Generic counter actions and button conditions now enforce Sweets eating, Silver Ring one-time Wear, and one-time Fishing Rod catches.",
    "Items use displayName for player-facing names while item object keys remain stable internal IDs.",
    "DROPDOWN_INVENTORY options separate internal value from player-facing label; unmatched inventory items use otherNext."
  ],
  "compilerWarnings": [
    "The app must read gameData.items when an inventory item is tapped.",
    "The app must understand the HOME next target for item dialogue buttons.",
    "Item dialogue navigation must allow Horn of Trees to open NPC page 0410.",
    "The app must support generic counter actions and counter(...) button conditions."
  ],
  "questDisplayNames": {
    "Buy Sweets": "Vegyél édességet",
    "Get Blobfish for Merchant": "Szerezz bluggyhalat a Kereskedőnek",
    "Get Great Salmon": "Szerezz nagy lazacot",
    "Give Fish to Messenger": "Add oda a halat a Hírnöknek",
    "Lost Messages": "Elveszett üzenetek",
    "Return Golden Medal to Guard": "Vidd vissza az aranymedált az őrnek",
    "Bird1": "Szerezz szalmát a Madárnak",
    "Bird2": "Szerezz szúnyogot a Madárnak",
    "Bird3": "Szerezz vázlatot egy megfelelő fészkelőhelyről a Madárnak",
    "Gém1": "Hozz egy aranyalmát a Gémnek"
  }
};
