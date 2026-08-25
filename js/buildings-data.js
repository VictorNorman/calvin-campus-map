const CALVIN_BUILDINGS = [
  {
    "id": "visitor-center",
    "name": "Visitor & Welcome Center",
    "aliases": ["visitor center", "welcome center", "welcome desk", "front desk"],
    "category": "Admissions",
    "lat": 42.9298772,
    "lon": -85.5892162,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.9295273, "lon": -85.5891683 },
      { "id": "entrance-2", "label": "Entrance 2", "lat": 42.9295766, "lon": -85.5887364 }
    ],
    "note": "Welcome desk inside the Wm. Spoelhof University Center"
  },
  {
    "id": "admissions",
    "name": "Admissions Office",
    "aliases": ["admissions", "financial aid", "enrollment"],
    "category": "Admissions",
    "lat": 42.9298772,
    "lon": -85.5892162,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.9295273, "lon": -85.5891683 },
      { "id": "entrance-2", "label": "Entrance 2", "lat": 42.9295766, "lon": -85.5887364 }
    ],
    "note": "Inside the Wm. Spoelhof University Center"
  },
  {
    "id": "spoelhof-university-center",
    "name": "Wm. Spoelhof University Center",
    "aliases": ["spoelhof center", "university center", "spoelhof university center"],
    "category": "Academic",
    "lat": 42.9298772,
    "lon": -85.5892162,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.9295273, "lon": -85.5891683 },
      { "id": "entrance-2", "label": "Entrance 2", "lat": 42.9295766, "lon": -85.5887364 },
      { "id": "entrance-3", "label": "Entrance 3", "lat": 42.930422304554355, "lon": -85.58941305855464 },
      { "id": "entrance-4", "label": "Entrance 4", "lat": 42.930420130013744, "lon": -85.58918734254144 }
    ]
  },
  {
    "id": "campus-store",
    "name": "Campus Store",
    "aliases": ["campus store", "bookstore", "book store"],
    "category": "Shopping & Dining",
    "lat": 42.93082,
    "lon": -85.58727,
    "entrances": [],
    "note": "Inside the Commons building, near Johnny's Café"
  },
  {
    "id": "event-parking",
    "name": "Event Parking (Lot 16)",
    "aliases": ["event parking", "visitor parking", "guest parking"],
    "category": "Parking",
    "lat": 42.9298215,
    "lon": -85.5811356,
    "entrances": [],
    "note": "Closest visitor lot to the Prince Conference Center"
  },
  {
    "id": "hekman-library",
    "name": "Hekman Library",
    "aliases": ["library", "hekman"],
    "category": "Academic",
    "lat": 42.9297916,
    "lon": -85.5873726,
    "entrances": [
      { "id": "main", "label": "Main entrance", "lat": 42.9300108, "lon": -85.5871844 },
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.93022659563303, "lon": -85.58754496152933 },
      { "id": "entrance-2", "label": "Entrance 2", "lat": 42.92959597372882, "lon": -85.58720044763132 }
    ]
  },
  {
    "id": "hiemenga-hall",
    "name": "Hiemenga Hall",
    "aliases": ["hiemenga"],
    "category": "Academic",
    "lat": 42.9298129,
    "lon": -85.5881821,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.9296135, "lon": -85.5884649 },
      { "id": "entrance-2", "label": "Entrance 2", "lat": 42.9300874244596, "lon": -85.58845673542679 }
    ]
  },
  {
    "id": "calvin-chapel",
    "name": "Calvin University Chapel",
    "aliases": ["chapel"],
    "category": "Academic",
    "lat": 42.929219,
    "lon": -85.5884541,
    "entrances": [
      { "id": "main", "label": "Main entrance", "lat": 42.9294054, "lon": -85.5885246 },
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.92902768354884, "lon": -85.58839139675771 }
    ]
  },
  {
    "id": "north-hall",
    "name": "North Hall",
    "aliases": [],
    "category": "Academic",
    "lat": 42.931545,
    "lon": -85.5889186,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.9311757, "lon": -85.5887557 },
      { "id": "entrance-2", "label": "Entrance 2", "lat": 42.9312763, "lon": -85.5889196 },
      { "id": "entrance-3", "label": "Entrance 3", "lat": 42.9316642, "lon": -85.5887479, "preferred": true },
      { "id": "entrance-4", "label": "Entrance 4", "lat": 42.931851, "lon": -85.5891372 }
    ]
  },
  {
    "id": "bruce-dice-museum",
    "name": "Bruce Dice Museum",
    "aliases": ["dice museum", "anthropology museum", "museum"],
    "category": "Academic",
    "lat": 42.931545,
    "lon": -85.5889186,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.9316642, "lon": -85.5887479, "preferred": true }
    ],
    "note": "Inside North Hall, near entrance 3"
  },
  {
    "id": "science-building",
    "name": "Science Building",
    "aliases": ["science", "chemistry", "biology"],
    "category": "Academic",
    "lat": 42.9310122,
    "lon": -85.5889557,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.931221, "lon": -85.5892135 },
      { "id": "entrance-2", "label": "Entrance 2", "lat": 42.93092244678871, "lon": -85.58869730116365 },
      { "id": "entrance-3", "label": "Entrance 3", "lat": 42.93078762624265, "lon": -85.58916061298099 }
    ]
  },
  {
    "id": "devries-hall",
    "name": "DeVries Hall",
    "aliases": ["devries"],
    "category": "Academic",
    "lat": 42.9309459,
    "lon": -85.5895649,
    "entrances": [
      { "id": "main", "label": "Main entrance", "lat": 42.9308289, "lon": -85.5892909 }
    ]
  },
  {
    "id": "engineering-building",
    "name": "Engineering Building",
    "aliases": ["engineering"],
    "category": "Academic",
    "lat": 42.9316881,
    "lon": -85.5899102,
    "entrances": []
  },
  {
    "id": "devos-communication-center",
    "name": "DeVos Communication Center",
    "aliases": ["devos", "communication center"],
    "category": "Academic",
    "lat": 42.9300779,
    "lon": -85.5835201,
    "entrances": []
  },
  {
    "id": "school-of-business",
    "name": "School of Business",
    "aliases": ["business school"],
    "category": "Academic",
    "lat": 42.9298441,
    "lon": -85.583568,
    "entrances": []
  },
  {
    "id": "covenant-fine-arts-center",
    "name": "Covenant Fine Arts Center",
    "aliases": ["fine arts center", "cfac", "art gallery", "music"],
    "category": "Academic",
    "lat": 42.930554,
    "lon": -85.5859046,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.930522, "lon": -85.5864316 },
      { "id": "entrance-2", "label": "Entrance 2", "lat": 42.9305769, "lon": -85.5864316 },
      { "id": "entrance-3", "label": "Entrance 3", "lat": 42.930848512977406, "lon": -85.58611047684857 },
      { "id": "entrance-4", "label": "Entrance 4", "lat": 42.93026138838354, "lon": -85.58607780742554 },
      { "id": "entrance-5", "label": "Entrance 5", "lat": 42.93027443565751, "lon": -85.58594712973341 }
    ]
  },
  {
    "id": "bunker-interpretive-center",
    "name": "Bunker Interpretive Center",
    "aliases": ["bunker center", "ecosystem preserve"],
    "category": "Academic",
    "lat": 42.931881,
    "lon": -85.5821639,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.9318646, "lon": -85.5823308 },
      { "id": "entrance-2", "label": "Entrance 2", "lat": 42.9318744, "lon": -85.5819986 }
    ]
  },
  {
    "id": "prince-conference-center",
    "name": "Prince Conference Center",
    "aliases": ["prince center", "conference center", "hotel"],
    "category": "Event Space",
    "lat": 42.930347,
    "lon": -85.5821423,
    "entrances": []
  },
  {
    "id": "commons",
    "name": "Commons Dining Hall",
    "aliases": ["commons", "dining hall", "cafeteria"],
    "category": "Shopping & Dining",
    "lat": 42.9311682,
    "lon": -85.5871465,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.930978, "lon": -85.5874143 },
      { "id": "entrance-2", "label": "Entrance 2", "lat": 42.9312815, "lon": -85.58701 },
      { "id": "entrance-3", "label": "Entrance 3", "lat": 42.9313089, "lon": -85.5875411 },
      { "id": "entrance-4", "label": "Entrance 4", "lat": 42.9313411, "lon": -85.5874797 },
      { "id": "entrance-5", "label": "Entrance 5", "lat": 42.93094999061407, "lon": -85.58699236587643 }
    ]
  },
  {
    "id": "commons-annex",
    "name": "Commons Annex",
    "aliases": ["annex"],
    "category": "Shopping & Dining",
    "lat": 42.9306585,
    "lon": -85.5872208,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.93042592868227, "lon": -85.58726263110303 },
      { "id": "entrance-2", "label": "Entrance 2", "lat": 42.93088258040788, "lon": -85.58728639068373 }
    ]
  },
  {
    "id": "knollcrest-dining-hall",
    "name": "Knollcrest Dining Hall",
    "aliases": ["knollcrest dining"],
    "category": "Shopping & Dining",
    "lat": 42.9331727,
    "lon": -85.5861135,
    "entrances": []
  },
  {
    "id": "spoelhof-fieldhouse",
    "name": "Spoelhof Fieldhouse Complex",
    "aliases": ["fieldhouse"],
    "category": "Athletics",
    "lat": 42.9326213,
    "lon": -85.5896303,
    "entrances": [
      { "id": "main", "label": "Main entrance", "lat": 42.9328838, "lon": -85.5890901 }
    ]
  },
  {
    "id": "van-noord-arena",
    "name": "Van Noord Arena",
    "aliases": [],
    "category": "Athletics",
    "lat": 42.93354191,
    "lon": -85.58871828,
    "entrances": [
      { "id": "main", "label": "Main entrance", "lat": 42.9328838, "lon": -85.5890901 }
    ],
    "note": "Part of the Spoelhof Fieldhouse Complex; shares its main entrance with the Fieldhouse and Venema Aquatic Center"
  },
  {
    "id": "hoogenboom-center",
    "name": "Hoogenboom Health and Recreation Center",
    "aliases": ["hoogenboom", "rec center", "gym"],
    "category": "Athletics",
    "lat": 42.9331386,
    "lon": -85.589685,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.9328476, "lon": -85.5900827 }
    ]
  },
  {
    "id": "venema-aquatic-center",
    "name": "Venema Aquatic Center",
    "aliases": ["pool", "venema", "aquatic center"],
    "category": "Athletics",
    "lat": 42.9326213,
    "lon": -85.5896303,
    "entrances": [
      { "id": "main", "label": "Main entrance", "lat": 42.9328838, "lon": -85.5890901 }
    ]
  },
  {
    "id": "huizenga-tennis-track",
    "name": "Huizenga Tennis and Track Center",
    "aliases": ["tennis center", "track center"],
    "category": "Athletics",
    "lat": 42.93396,
    "lon": -85.5901996,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.9334856, "lon": -85.5903565 },
      { "id": "entrance-2", "label": "Entrance 2", "lat": 42.9336177, "lon": -85.5905589 },
      { "id": "entrance-3", "label": "Entrance 3", "lat": 42.9343222, "lon": -85.59059 }
    ]
  },
  {
    "id": "schultze-eldersveld",
    "name": "Schultze-Eldersveld Hall",
    "aliases": ["schultze", "eldersveld"],
    "category": "Residence Hall",
    "lat": 42.9318452,
    "lon": -85.5864936,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.9318365, "lon": -85.5868196 }
    ]
  },
  {
    "id": "rooks-vandellen",
    "name": "Rooks-VanDellen Hall",
    "aliases": ["rooks", "vandellen"],
    "category": "Residence Hall",
    "lat": 42.9326403,
    "lon": -85.5878248,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.932449, "lon": -85.5876363 }
    ]
  },
  {
    "id": "bolt-heyns-timmer",
    "name": "Bolt-Heyns-Timmer Hall",
    "aliases": ["bolt", "heyns", "timmer"],
    "category": "Residence Hall",
    "lat": 42.9320434,
    "lon": -85.588025,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.9319112, "lon": -85.5878853 }
    ]
  },
  {
    "id": "noordewier-vanderwerp",
    "name": "Noordewier-VanderWerp Hall",
    "aliases": ["noordewier", "vanderwerp"],
    "category": "Residence Hall",
    "lat": 42.9334095,
    "lon": -85.5873036,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.933226, "lon": -85.5869923 }
    ]
  },
  {
    "id": "boer-bennink",
    "name": "Boer-Bennink Hall",
    "aliases": ["boer", "bennink"],
    "category": "Residence Hall",
    "lat": 42.9340636,
    "lon": -85.5862342,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.9337474, "lon": -85.5864686 }
    ]
  },
  {
    "id": "beets-veenstra",
    "name": "Beets-Veenstra Hall",
    "aliases": ["beets", "veenstra"],
    "category": "Residence Hall",
    "lat": 42.9325413,
    "lon": -85.5858431,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.9326596, "lon": -85.5860746 }
    ]
  },
  {
    "id": "kalsbeek-huizenga-vanreken",
    "name": "Kalsbeek-Huizenga-VanReken Hall",
    "aliases": ["kalsbeek", "huizenga hall", "vanreken"],
    "category": "Residence Hall",
    "lat": 42.9348291,
    "lon": -85.5870939,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.9344396, "lon": -85.5870625 },
      { "id": "entrance-2", "label": "Entrance 2", "lat": 42.9349602, "lon": -85.5875639 }
    ]
  },
  {
    "id": "knollcrest-east-alpha",
    "name": "Alpha House (Knollcrest East)",
    "aliases": ["alpha"],
    "category": "Apartments",
    "lat": 42.927187,
    "lon": -85.5833123,
    "entrances": []
  },
  {
    "id": "knollcrest-east-beta",
    "name": "Beta House (Knollcrest East)",
    "aliases": ["beta"],
    "category": "Apartments",
    "lat": 42.9274832,
    "lon": -85.5832248,
    "entrances": []
  },
  {
    "id": "knollcrest-east-gamma",
    "name": "Gamma House (Knollcrest East)",
    "aliases": ["gamma"],
    "category": "Apartments",
    "lat": 42.9272421,
    "lon": -85.5829269,
    "entrances": []
  },
  {
    "id": "knollcrest-east-delta",
    "name": "Delta House (Knollcrest East)",
    "aliases": ["delta"],
    "category": "Apartments",
    "lat": 42.9275484,
    "lon": -85.5828394,
    "entrances": []
  },
  {
    "id": "knollcrest-east-epsilon",
    "name": "Epsilon House (Knollcrest East)",
    "aliases": ["epsilon"],
    "category": "Apartments",
    "lat": 42.9281338,
    "lon": -85.5824873,
    "entrances": []
  },
  {
    "id": "knollcrest-east-zeta-lambda",
    "name": "Zeta-Lambda House (Knollcrest East)",
    "aliases": ["zeta", "lambda"],
    "category": "Apartments",
    "lat": 42.9275665,
    "lon": -85.5817669,
    "entrances": []
  },
  {
    "id": "knollcrest-east-theta",
    "name": "Theta House (Knollcrest East)",
    "aliases": ["theta"],
    "category": "Apartments",
    "lat": 42.9280228,
    "lon": -85.5829403,
    "entrances": []
  },
  {
    "id": "knollcrest-east-kappa",
    "name": "Kappa House (Knollcrest East)",
    "aliases": ["kappa"],
    "category": "Apartments",
    "lat": 42.9273485,
    "lon": -85.582554,
    "entrances": []
  },
  {
    "id": "knollcrest-east-sigma",
    "name": "Sigma House (Knollcrest East)",
    "aliases": ["sigma"],
    "category": "Apartments",
    "lat": 42.9272465,
    "lon": -85.5809848,
    "entrances": []
  },
  {
    "id": "knollcrest-east-omega",
    "name": "Omega House (Knollcrest East)",
    "aliases": ["omega"],
    "category": "Apartments",
    "lat": 42.9275385,
    "lon": -85.5810039,
    "entrances": []
  },
  {
    "id": "knollcrest-east-tau",
    "name": "Tau House (Knollcrest East)",
    "aliases": ["tau"],
    "category": "Apartments",
    "lat": 42.9275258,
    "lon": -85.5799033,
    "entrances": []
  },
  {
    "id": "knollcrest-east-rho",
    "name": "Rho House (Knollcrest East)",
    "aliases": ["rho"],
    "category": "Apartments",
    "lat": 42.9272213,
    "lon": -85.5798913,
    "entrances": []
  },
  {
    "id": "phi-chi",
    "name": "Phi-Chi House (Knollcrest East)",
    "aliases": ["phi", "chi"],
    "category": "Apartments",
    "lat": 42.9287407,
    "lon": -85.5817306,
    "entrances": []
  },
  {
    "id": "dewit-manor",
    "name": "DeWit Manor",
    "aliases": ["dewit"],
    "category": "Residence Hall",
    "lat": 42.9286362,
    "lon": -85.5881947,
    "entrances": []
  },
  {
    "id": "lot-1",
    "name": "Parking Lot 1",
    "aliases": ["lot 1"],
    "category": "Parking",
    "lat": 42.9280137,
    "lon": -85.5900291,
    "entrances": []
  },
  {
    "id": "lot-2",
    "name": "Parking Lot 2",
    "aliases": ["lot 2"],
    "category": "Parking",
    "lat": 42.9290966,
    "lon": -85.590351,
    "entrances": []
  },
  {
    "id": "lot-3",
    "name": "Parking Lot 3",
    "aliases": ["lot 3"],
    "category": "Parking",
    "lat": 42.9300105,
    "lon": -85.5904131,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.9304853661632, "lon": -85.59018821493925 },
      { "id": "entrance-2", "label": "Entrance 2", "lat": 42.92973949510488, "lon": -85.59015554552475 }
    ]
  },
  {
    "id": "lot-4",
    "name": "Parking Lot 4",
    "aliases": ["lot 4"],
    "category": "Parking",
    "lat": 42.9310126,
    "lon": -85.5904529,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.930678899740116, "lon": -85.59020009472957 }
    ]
  },
  {
    "id": "lot-5",
    "name": "Parking Lot 5",
    "aliases": ["lot 5"],
    "category": "Parking",
    "lat": 42.9317937,
    "lon": -85.590484,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.931896625157975, "lon": -85.59024464391872 }
    ]
  },
  {
    "id": "lot-6",
    "name": "Parking Lot 6",
    "aliases": ["lot 6"],
    "category": "Parking",
    "lat": 42.9328083,
    "lon": -85.5904328,
    "entrances": [
      { "id": "entrance-1", "label": "Entrance 1", "lat": 42.93278888561241, "lon": -85.59013828394848 },
      { "id": "entrance-2", "label": "Entrance 2", "lat": 42.93249288206894, "lon": -85.59014360356447 }
    ]
  },
  {
    "id": "lot-7",
    "name": "Parking Lot 7",
    "aliases": ["lot 7"],
    "category": "Parking",
    "lat": 42.9346662,
    "lon": -85.5901486,
    "entrances": []
  },
  {
    "id": "lot-8",
    "name": "Parking Lot 8",
    "aliases": ["lot 8"],
    "category": "Parking",
    "lat": 42.9359015,
    "lon": -85.5867799,
    "entrances": []
  },
  {
    "id": "lot-9",
    "name": "Parking Lot 9",
    "aliases": ["lot 9"],
    "category": "Parking",
    "lat": 42.9309909,
    "lon": -85.5862498,
    "entrances": []
  },
  {
    "id": "lot-10",
    "name": "Parking Lot 10",
    "aliases": ["lot 10"],
    "category": "Parking",
    "lat": 42.9300609,
    "lon": -85.5862219,
    "entrances": []
  },
  {
    "id": "lot-11",
    "name": "Parking Lot 11",
    "aliases": ["lot 11"],
    "category": "Parking",
    "lat": 42.9280609,
    "lon": -85.5853072,
    "entrances": []
  },
  {
    "id": "lot-13",
    "name": "Parking Lot 13",
    "aliases": ["lot 13"],
    "category": "Parking",
    "lat": 42.9335755,
    "lon": -85.5840924,
    "entrances": []
  },
  {
    "id": "lot-14",
    "name": "Parking Lot 14",
    "aliases": ["lot 14"],
    "category": "Parking",
    "lat": 42.9293533,
    "lon": -85.5832673,
    "entrances": []
  },
  {
    "id": "lot-15",
    "name": "Parking Lot 15",
    "aliases": ["lot 15"],
    "category": "Parking",
    "lat": 42.9295465,
    "lon": -85.5823068,
    "entrances": []
  },
  {
    "id": "lot-16",
    "name": "Parking Lot 16",
    "aliases": ["lot 16"],
    "category": "Parking",
    "lat": 42.9298215,
    "lon": -85.5811356,
    "entrances": []
  },
  {
    "id": "lot-17",
    "name": "Parking Lot 17",
    "aliases": ["lot 17"],
    "category": "Parking",
    "lat": 42.9286193,
    "lon": -85.5829515,
    "entrances": []
  },
  {
    "id": "lot-18",
    "name": "Parking Lot 18",
    "aliases": ["lot 18"],
    "category": "Parking",
    "lat": 42.9271928,
    "lon": -85.5836608,
    "entrances": []
  },
  {
    "id": "lot-19",
    "name": "Parking Lot 19",
    "aliases": ["lot 19"],
    "category": "Parking",
    "lat": 42.9275265,
    "lon": -85.5814303,
    "entrances": []
  },
  {
    "id": "lot-20",
    "name": "Parking Lot 20",
    "aliases": ["lot 20"],
    "category": "Parking",
    "lat": 42.9274923,
    "lon": -85.5797223,
    "entrances": []
  }
]
;
