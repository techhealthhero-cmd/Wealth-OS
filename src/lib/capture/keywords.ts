/**
 * Keyword → category and brand dictionaries for Quick Capture parsing.
 *
 * Categories are referenced by the SYSTEM category's `name_en` (seeded in
 * migration 0002) rather than by id, so this file never needs database ids;
 * the parser resolves `categoryKey` to the user's actual category row at
 * runtime. Order inside a list doesn't matter — the parser always prefers
 * the LONGEST matching keyword across all categories, so "น้ำมัน" (fuel)
 * beats "น้ำ" (a drink) and "grabfood" beats "grab".
 *
 * Keywords of 2 characters or fewer only match a whole whitespace-separated
 * token (Thai has no word spaces, so a bare "ยา" would otherwise match
 * inside unrelated words).
 */

export type ExpenseCategoryKey =
  | "Food & Dining"
  | "Transport"
  | "Housing"
  | "Shopping"
  | "Health"
  | "Entertainment"
  | "Education"
  | "Utilities"
  | "Subscriptions"
  | "Insurance"
  | "Family"
  | "Gift"
  | "Other";

export type IncomeCategoryKey = "Salary" | "Freelance" | "Business" | "Bonus" | "Interest" | "Cashback/Refund" | "Gift" | "Other";

export const EXPENSE_CATEGORY_KEYWORDS: Record<Exclude<ExpenseCategoryKey, "Other">, string[]> = {
  "Food & Dining": [
    "ข้าว", "กิน", "อาหาร", "ก๋วยเตี๋ยว", "กาแฟ", "ชานม", "ชาเขียว", "ขนม", "ส้มตำ", "หมูกระทะ", "ชาบู",
    "บุฟเฟ่ต์", "บุฟเฟ่", "พิซซ่า", "ข้าวมันไก่", "ผัดไทย", "เบเกอรี่", "ร้านอาหาร", "มื้อเที่ยง", "มื้อเย็น",
    "ชา", "น้ำ",
    // Everyday street food that otherwise fell to "อื่นๆ" (2026-10-03 voice-capture probe).
    "ไก่", "หมู", "ลูกชิ้น", "ไส้กรอก", "หมูปิ้ง", "กะเพรา", "กระเพรา", "ชาไทย", "ชาดำ", "โจ๊ก", "ขนมจีน",
    "ไข่", "แกง", "ต้มยำ", "ข้าวเหนียว", "น้ำแข็ง", "น้ำเปล่า", "ผลไม้", "ไอติม", "ไอศกรีม",
    "coffee", "cafe", "lunch", "dinner", "breakfast", "food", "restaurant", "kfc", "mcdonald", "mcdonalds",
    "starbucks", "amazon", "cafe amazon", "mk", "sukiya", "yayoi", "sizzler", "swensen", "after you",
    "grabfood", "grab food", "lineman", "line man", "foodpanda", "robinhood", "7-eleven", "7-11", "เซเว่น",
    "family mart", "familymart", "lawson",
  ],
  Transport: [
    "แท็กซี่", "รถไฟฟ้า", "ล้างรถ", "น้ำมัน", "เติมน้ำมัน", "มอไซค์", "วินมอไซค์", "มอไซต์", "วินมอไซต์", "มอเตอร์ไซค์", "วินมอเตอร์ไซค์", "ทางด่วน", "จอดรถ", "รถเมล์", "ค่ารถ",
    "เดินทาง", "ตั๋ว", "grab", "bolt", "taxi", "bts", "mrt", "ptt", "shell", "bangchak", "esso", "caltex",
    "parking", "bus", "fuel", "gas", "easy pass", "m-flow", "airasia", "nok air", "thai airways",
  ],
  Housing: ["ค่าเช่า", "ค่าห้อง", "ค่าหอ", "ค่าส่วนกลาง", "rent", "condo"],
  Shopping: [
    "ช้อปปิ้ง", "ซื้อของ", "เสื้อ", "รองเท้า", "กระเป๋า", "เครื่องสำอาง", "shopee", "lazada", "uniqlo",
    "central", "big c", "bigc", "lotus", "โลตัส", "makro", "แม็คโคร", "ikea", "tops", "watsons", "boots",
    "homepro", "shopping",
  ],
  Health: [
    "ยา", "หมอ", "โรงพยาบาล", "คลินิก", "ทำฟัน", "หาหมอ", "ฟิตเนส", "pharmacy", "hospital", "clinic",
    "dentist", "gym", "fitness",
  ],
  Entertainment: [
    "หนัง", "ดูหนัง", "เกม", "คอนเสิร์ต", "คาราโอเกะ", "cinema", "movie", "major", "sf cinema", "game",
    "steam", "playstation", "concert",
    // Recreational / nightlife (2026-10-05: "ปุ้น" — cannabis slang — had no category).
    "กัญชา", "ปุ้น", "ปุ๊น", "ปุ๊นปุ้น", "ปุ้นปุ้น", "ใบเขียว", "บุหรี่", "บุหรี่ไฟฟ้า", "พอต", "เหล้า", "เบียร์",
    "ผับ", "บาร์", "ปาร์ตี้", "เที่ยว", "weed", "cannabis", "beer", "bar",
  ],
  Education: ["หนังสือ", "คอร์ส", "ค่าเรียน", "ค่าเทอม", "course", "udemy", "coursera", "book", "books"],
  Utilities: [
    "ค่าไฟ", "ไฟฟ้า", "ค่าน้ำ", "ประปา", "ค่าเน็ต", "อินเทอร์เน็ต", "ค่าโทรศัพท์", "ค่ามือถือ", "เติมเงินมือถือ",
    "mea", "pea", "mwa", "pwa", "internet", "3bb", "ais", "dtac", "true online", "true move", "electricity",
    "water bill",
  ],
  Subscriptions: [
    "netflix", "spotify", "youtube premium", "youtube", "disney", "disney+", "icloud", "apple music",
    "chatgpt", "claude", "prime video", "hbo", "viu", "canva", "adobe", "subscription",
  ],
  Insurance: ["ประกัน", "เบี้ยประกัน", "insurance"],
  Family: ["ให้แม่", "ให้พ่อ", "ค่าขนมลูก", "family"],
  // Buying/giving a gift (migration 0039).
  Gift: ["ของขวัญ", "ซื้อของขวัญ", "อั่งเปา", "แต๊ะเอีย", "ใส่ซอง", "ซองงาน", "gift", "present"],
};

export const INCOME_CATEGORY_KEYWORDS: Record<Exclude<IncomeCategoryKey, "Other">, string[]> = {
  Salary: ["เงินเดือน", "salary", "payroll"],
  Freelance: ["ฟรีแลนซ์", "freelance", "ค่าจ้าง", "ค่าคอม", "คอมมิชชัน", "คอมมิชชั่น", "commission"],
  Business: ["ขายของ", "ยอดขาย", "ขาย", "sales"],
  Bonus: ["โบนัส", "bonus"],
  Interest: ["ดอกเบี้ย", "interest", "ปันผล", "dividend"],
  // A friend paying back / chipping in for a shared bill is money back to me.
  "Cashback/Refund": ["เงินคืน", "cashback", "refund", "คืนเงิน", "มาคืน", "คืนมา"],
  // Money received as a gift (migration 0039). Never decides the TYPE on its
  // own (see detectType) — "อั่งเปา 500" alone is one I gave.
  Gift: ["ของขวัญ", "ค่าวันเกิด", "เงินวันเกิด", "วันเกิด", "อั่งเปา", "แต๊ะเอีย", "รับซอง", "gift"],
};

/** Words that mark a capture as INCOME rather than an expense. */
export const INCOME_MARKERS = [
  "รายรับ", "ได้เงิน", "ได้รับเงิน", "ได้รับ", "income", "received",
  // Someone GAVE me money ("แม่ให้ 2000"); the reverse order ("ให้แม่") is a Family expense.
  "แม่ให้", "พ่อให้", "ยายให้", "ตาให้", "ปู่ให้", "ย่าให้", "พี่ให้", "น้องให้", "แฟนให้", "เพื่อนให้", "ลูกให้",
  "ให้มา", "โอนมาให้", "เงินเข้า", "เงินเดือนออก", "ขายได้", "ได้ทิป",
  // Added 2026-10-03 after a probe of everyday spoken recaps.
  "ขาย", "โอนมา", "ลูกค้าโอน", "ลูกค้าจ่าย", "ถูกหวย", "ถูกรางวัล", "ได้ค่า", "ค่าคอม", "คอมมิชชัน", "คอมมิชชั่น",
  "ปันผล", "ดอกเบี้ยรับ", "เงินปันผล",
  // 2026-10-05: money back from friends.
  "มาคืน", "คืนมา", "เงินคืน",
  "ได้ของขวัญ", "ได้อั่งเปา", "ได้แต๊ะเอีย", "ได้ซอง",
];

/**
 * Well-known merchants → display name. When one appears in the text it
 * becomes the transaction's `merchant` (and the key category learning
 * remembers). Also removed from the text before amount extraction, so
 * digits inside a brand ("7-11", "3BB") are never mistaken for the amount.
 */
export const KNOWN_MERCHANTS: { match: string[]; name: string }[] = [
  { match: ["grabfood", "grab food"], name: "GrabFood" },
  { match: ["grab"], name: "Grab" },
  { match: ["bolt"], name: "Bolt" },
  { match: ["lineman", "line man"], name: "LINE MAN" },
  { match: ["foodpanda"], name: "foodpanda" },
  { match: ["7-eleven", "7-11", "7eleven", "เซเว่น"], name: "7-Eleven" },
  { match: ["family mart", "familymart"], name: "FamilyMart" },
  { match: ["lawson"], name: "Lawson" },
  { match: ["kfc"], name: "KFC" },
  { match: ["mcdonalds", "mcdonald", "แมค"], name: "McDonald's" },
  { match: ["starbucks", "สตาบัค"], name: "Starbucks" },
  { match: ["cafe amazon", "amazon"], name: "Café Amazon" },
  { match: ["netflix"], name: "Netflix" },
  { match: ["spotify"], name: "Spotify" },
  { match: ["youtube premium", "youtube"], name: "YouTube" },
  { match: ["disney+", "disney"], name: "Disney+" },
  { match: ["icloud"], name: "iCloud" },
  { match: ["chatgpt"], name: "ChatGPT" },
  { match: ["shopee"], name: "Shopee" },
  { match: ["lazada"], name: "Lazada" },
  { match: ["uniqlo"], name: "Uniqlo" },
  { match: ["big c", "bigc"], name: "Big C" },
  { match: ["lotus", "โลตัส"], name: "Lotus's" },
  { match: ["makro", "แม็คโคร"], name: "Makro" },
  { match: ["ikea"], name: "IKEA" },
  { match: ["mea", "การไฟฟ้านครหลวง"], name: "MEA" },
  { match: ["pea", "การไฟฟ้าส่วนภูมิภาค"], name: "PEA" },
  { match: ["mwa", "การประปานครหลวง"], name: "MWA" },
  { match: ["3bb"], name: "3BB" },
  { match: ["ais"], name: "AIS" },
  { match: ["dtac"], name: "dtac" },
  { match: ["ptt"], name: "PTT" },
  { match: ["shell"], name: "Shell" },
  { match: ["bangchak"], name: "Bangchak" },
  { match: ["bts"], name: "BTS" },
  { match: ["mrt"], name: "MRT" },
];

/**
 * Payment-method phrases → how to find the user's matching account.
 * `type` matches `accounts.account_type`; `aliases` match against the
 * account's name/institution (lowercased).
 */
export const ACCOUNT_HINTS: { phrases: string[]; type?: string; aliases?: string[] }[] = [
  { phrases: ["เงินสด", "cash", "สด"], type: "cash" },
  { phrases: ["บัตรเครดิต", "credit card", "credit", "บัตร"], type: "credit_card" },
  { phrases: ["kbank", "k plus", "kplus", "กสิกร", "กสิกรไทย", "kasikorn"], aliases: ["kbank", "kasikorn", "กสิกร", "k plus", "kplus"] },
  { phrases: ["scb", "ไทยพาณิชย์", "siam commercial"], aliases: ["scb", "ไทยพาณิชย์", "siam commercial"] },
  { phrases: ["bbl", "bangkok bank", "กรุงเทพ", "บัวหลวง"], aliases: ["bbl", "bangkok bank", "กรุงเทพ", "บัวหลวง"] },
  { phrases: ["ktb", "krungthai", "กรุงไทย", "เป๋าตัง"], aliases: ["ktb", "krungthai", "กรุงไทย", "เป๋าตัง"] },
  { phrases: ["krungsri", "กรุงศรี", "bay"], aliases: ["krungsri", "กรุงศรี", "bay"] },
  { phrases: ["ttb", "ทีทีบี", "ทหารไทย"], aliases: ["ttb", "ทีทีบี", "ทหารไทย", "tmb"] },
  { phrases: ["gsb", "ออมสิน", "mymo"], aliases: ["gsb", "ออมสิน", "mymo"] },
  { phrases: ["truemoney", "true money", "true wallet", "ทรูมันนี่", "ทรูวอลเล็ท"], aliases: ["truemoney", "true money", "true wallet", "ทรู"] },
  { phrases: ["shopeepay", "shopee pay"], aliases: ["shopeepay", "shopee pay"] },
  { phrases: ["rabbit line pay", "line pay", "linepay"], aliases: ["line pay", "linepay", "rabbit"] },
];

/** Filler words stripped when building the description. */
export const FILLER_WORDS = [
  "เมื่อกี้", "เมื่อกี๊", "ตะกี้", "เมื่อสักครู่", "วันนี้", "เมื่อวานซืน", "เมื่อวาน", "today", "yesterday",
  "จ่ายด้วย", "จ่ายผ่าน", "จ่าย", "ผ่าน", "ด้วย", "โดย", "paid", "pay", "with", "via", "by",
  "บาท", "baht", "thb", "ครับ", "ค่ะ", "คะ", "นะ",
];

/** Leading verbs dropped from a description ("ซื้อกาแฟ" → "กาแฟ", "กินข้าว" → "ข้าว"). */
export const LEADING_VERBS = ["ซื้อ", "กิน", "เติม", "buy", "bought", "ate"];
