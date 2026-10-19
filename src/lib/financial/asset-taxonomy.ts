import type { ASSET_TYPES } from "@/lib/validation/asset";

export type ValuationMode = "declining" | "compound" | "market" | "fixed";
export type AssetType = (typeof ASSET_TYPES)[number];
export interface ValuationRule {
  mode: ValuationMode;
  /** Positive percentages: loss for declining, growth for compound. */
  annualRatePct?: number;
  firstYearRatePct?: number;
  floorPct?: number;
  sourceRefs: string[];
  confidence: "✅" | "🧮" | "⚠️";
  /** Only gold has an approved compound fallback in market mode. */
  marketFallbackRatePct?: number;
}
export interface AssetPreset extends ValuationRule { key: string; labelTh: string; labelEn: string; keywords: string[] }
export interface AssetGroup extends ValuationRule {
  key: string; labelTh: string; labelEn: string; emoji: string; assetType: AssetType;
  captureTier: "always" | "durable" | null;
  subcategories: AssetPreset[];
}
const preset = (key: string, th: string, en: string, words: string, rate?: number, first?: number, refs = "L6", mode: ValuationMode = "declining", floorPct = 10, confidence: ValuationRule["confidence"] = "⚠️"): AssetPreset => ({
  key, labelTh: th, labelEn: en, keywords: words.split("|"), mode, annualRatePct: rate,
  firstYearRatePct: first, floorPct, sourceRefs: refs.split(" "), confidence,
});
const group = (key: string, labelTh: string, labelEn: string, emoji: string, assetType: AssetType, mode: ValuationMode, captureTier: AssetGroup["captureTier"], subcategories: AssetPreset[]): AssetGroup => ({
  key, labelTh, labelEn, emoji, assetType, mode, captureTier, subcategories,
  annualRatePct: mode === "declining" ? 10 : mode === "compound" ? 0 : undefined,
  floorPct: 10, sourceRefs: ["L5"], confidence: "⚠️",
});
/** Research /workspace/research/asset-value-rates.md, L5: all 26 groups.
 * Rates describe illustrative resale estimates, never guaranteed returns or tax depreciation.
 */
export const ASSET_GROUPS: readonly AssetGroup[] = [
  group("cash_deposits", "เงินสดและเงินฝาก", "Cash and deposits", "💵", "bank", "compound", null, [preset("deposit", "เงินฝาก", "Deposit", "เงินฝาก|ออมทรัพย์|ฝากประจำ|deposit|e-wallet", .5, undefined, "[Z1] [Z2]", "compound"), preset("foreign_currency", "เงินตราต่างประเทศ", "Foreign currency", "เงินตราต่างประเทศ|forex", undefined, undefined, "[Z2]", "market")]),
  group("market_investments", "การลงทุนตลาด", "Market investments", "📊", "investment", "market", null, [preset("thai_stocks", "หุ้นไทย", "Thai stocks", "หุ้นไทย|หุ้น|set|stock", undefined, undefined, "[I1] [I2]", "market"), preset("funds", "กองทุน", "Funds", "กองทุน|rmf|ssf|thaiesg|etf|fund|reit|พันธบัตร|หุ้นกู้", undefined, undefined, "[J1] L6", "market")]),
  group("insurance_savings", "ประกันและเงินออมพิเศษ", "Insurance and special savings", "🛡️", "savings", "market", null, [preset("cash_value", "มูลค่าเวนคืน", "Surrender value", "ประกันชีวิต|สลากออม|สำรองเลี้ยงชีพ|กบข|surrender", undefined, undefined, "L6", "market")]),
  group("precious_metals", "ทองและโลหะมีค่า", "Precious metals", "🪙", "gold", "market", "always", [{ ...preset("gold", "ทองคำ", "Gold", "ทองคำ|ทอง|gold", undefined, undefined, "[G1] [G2]", "market", 0, "🧮"), marketFallbackRatePct: 9 }, preset("silver", "เงินและแพลทินัม", "Silver and platinum", "แพลทินัม|platinum|silver", undefined, undefined, "[T2]", "market")]),
  group("digital_assets", "สินทรัพย์ดิจิทัล", "Digital assets", "₿", "crypto", "market", null, [preset("bitcoin", "บิตคอยน์", "Bitcoin", "bitcoin|btc|บิตคอยน์|คริปโต|crypto|stablecoin", undefined, undefined, "[H1] [H2]", "market"), preset("nft", "NFT", "NFT", "nft", 50, undefined, "[Y1] [Y2]"), preset("digital_items", "โดเมนและไอเทมเกม", "Domains and game items", "โดเมน|domain|สกินเกม|บัญชีเกม", undefined, undefined, "L6", "market")]),
  group("real_estate", "อสังหาริมทรัพย์", "Real estate", "🏠", "property", "compound", "always", [preset("land", "ที่ดิน", "Land", "ที่ดิน|land|สวน|ไร่|นาเปล่า", 5, undefined, "[K2]", "compound"), preset("condo", "คอนโด", "Condominium", "คอนโด|condo", 2, undefined, "[K1]", "compound"), preset("house", "บ้าน", "House", "บ้าน|house|ทาวน์โฮม|อาคารพาณิชย์|property", 2, undefined, "[K1]", "compound")]),
  group("land_vehicles", "ยานพาหนะทางบก", "Land vehicles", "🚗", "vehicle", "declining", "always", [preset("motorcycle", "มอเตอร์ไซค์", "Motorcycle", "มอเตอร์ไซค์|มอไซค์|มอไซ|motorcycle|motorbike|honda click|บิ๊กไบค์", 12, undefined, "[E1]"), preset("used_car", "รถยนต์มือสอง", "Used car", "รถมือสอง|รถยนต์มือสอง|used car", 10, undefined, "[F1]"), preset("car", "รถยนต์", "Car", "รถยนต์|รถ|car|กระบะ|รถบรรทุก|รถตู้|รถพ่วง|tesla|toyota", 12, 20, "[F1] [F2]", "declining", 10, "✅")]),
  group("special_vehicles", "ยานพาหนะพิเศษ", "Special vehicles", "🚤", "vehicle", "declining", "always", [preset("drone", "โดรน", "Drone", "โดรน|drone|dji", 30), preset("boat", "เรือ", "Boat", "เรือ|boat|เจ็ตสกี|jet ski", 4, 15, "[N1]"), preset("aircraft", "เครื่องบินเล็ก", "Light aircraft", "เครื่องบิน|cessna|aircraft", undefined, undefined, "[N2] [N3]", "market")]),
  group("heavy_machinery", "เครื่องจักรหนักและเกษตร", "Heavy and farm machinery", "🚜", "business", "declining", "always", [preset("tractor", "รถแทรกเตอร์", "Tractor", "แทรกเตอร์|tractor|รถไถ|kubota", 8, 20, "[HM4] [HM5]"), preset("harvester", "รถเกี่ยวข้าว", "Harvester", "รถเกี่ยว|harvester", 11.5, undefined, "[HM4]", "declining", 10, "🧮"), preset("excavator", "รถขุด", "Excavator", "รถขุด|แม็คโคร|แบ็คโฮ|excavator", 10, undefined, "[HM1] [HM2]"), preset("machinery", "เครื่องจักร", "Machinery", "เครื่องจักร|ปั๊มน้ำ|เครื่องปั่นไฟ|generator", 10)]),
  group("livestock_pets", "ปศุสัตว์และสัตว์เลี้ยง", "Livestock and pets", "🐄", "business", "market", "always", [preset("livestock", "ปศุสัตว์", "Livestock", "ปศุสัตว์|วัว|โคเนื้อ|กระบือ|ควาย|สุกร|ไก่ชน|livestock|cattle|ปลาคาร์ฟ|ปลากัด|สุนัขพันธุ์|แมวพันธุ์", undefined, undefined, "[V1] [V2] [V3]", "market")]),
  group("tools_materials", "เครื่องมือช่างและวัสดุ", "Tools and materials", "🔧", "other", "declining", "durable", [preset("power_tools", "เครื่องมือไฟฟ้า", "Power tools", "สว่าน|เครื่องเชื่อม|เครื่องมือไฟฟ้า|drill|power tool|makita", 15, 30, "[X1]"), preset("hand_tools", "เครื่องมือช่าง", "Hand tools", "เครื่องมือ|ประแจ|นั่งร้าน|hand tool|wrench", 10, undefined, "[X1]"), preset("parts", "อะไหล่และวัสดุ", "Parts and materials", "อะไหล่|วัสดุคงคลัง|spare parts", 10)]),
  group("creator_equipment", "อุปกรณ์ครีเอเตอร์", "Creator equipment", "🎥", "other", "declining", "durable", [preset("lens", "เลนส์", "Lens", "เลนส์|lens", 5, 20, "[C2] [C3]"), preset("camera", "กล้อง", "Camera", "กล้อง|camera|canon|nikon", 15, 20, "[C2]"), preset("audio", "อุปกรณ์เสียง", "Audio equipment", "ไมค์|microphone|interface|กิมบอล|gimbal|ซินธ์|synth|ไฟสตูดิโอ", undefined, undefined, "[Q4] L6", "market")]),
  group("musical_instruments", "เครื่องดนตรี", "Musical instruments", "🎸", "other", "declining", "durable", [preset("instrument", "เครื่องดนตรี", "Instrument", "กีตาร์|guitar|เปียโน|piano|คีย์บอร์ดดนตรี|กลอง|drums|เครื่องดนตรี|แซกโซโฟน|ไวโอลิน", 2, 30, "[Q1] [Q2]")]),
  group("it_electronics", "ไอทีและอิเล็กทรอนิกส์", "IT and electronics", "💻", "other", "declining", "durable", [preset("phone", "โทรศัพท์", "Phone", "ไอโฟน|iphone|โทรศัพท์|มือถือ|smartphone|phone|samsung galaxy", 20, 40, "[B1] [B2]", "declining", 5), preset("tablet", "แท็บเล็ต", "Tablet", "แท็บเล็ต|tablet|ipad|ไอแพด", 20, 30, "[A1]", "declining", 5), preset("headphones", "หูฟัง", "Headphones", "หูฟัง|headphones|airpods", 20, 40, "L6", "declining", 5), preset("printer", "เครื่องพิมพ์", "Printer", "เครื่องพิมพ์|printer", 30, undefined, "L6", "declining", 5), preset("laptop", "โน้ตบุ๊ก", "Laptop", "โน้ตบุ๊ก|โน๊ตบุ๊ค|โน้ตบุ๊ค|laptop|macbook|แมคบุ๊ค", 25, undefined, "[A1] [A2]", "declining", 5, "✅"), preset("computer", "คอมพิวเตอร์", "Computer", "คอมพิวเตอร์|คอม|computer|desktop|pc|จอคอม|monitor|เซิร์ฟเวอร์|nas|คอนโซล|playstation|xbox", 25, undefined, "[A3]", "declining", 5)]),
  // Research furniture is SL; approved product model uses DB at the same 20%.
  group("home_appliances", "เครื่องใช้ในบ้าน", "Home appliances", "🏡", "other", "declining", "durable", [preset("tv", "ทีวี", "TV", "ทีวี|โทรทัศน์|television|tv", 15, 25, "[C1]"), preset("furniture", "เฟอร์นิเจอร์", "Furniture", "เฟอร์นิเจอร์|furniture|โซฟา|sofa|โต๊ะ|เตียง|ตู้เสื้อผ้า", 20, undefined, "[R1]"), preset("appliance", "เครื่องใช้ไฟฟ้า", "Appliance", "ตู้เย็น|refrigerator|แอร์|air conditioner|เครื่องซักผ้า|washing machine|เครื่องล้างจาน|เครื่องครัว", 15, undefined, "[D1]")]),
  group("luxury_fashion", "แฟชั่นหรู", "Luxury fashion", "👜", "other", "market", "always", [preset("hermes", "กระเป๋า Hermès", "Hermès bag", "hermès|hermes|birkin|kelly|แอร์เมส", 3, undefined, "[L1] [L2]", "compound"), preset("chanel_classic", "Chanel Classic Flap", "Chanel Classic Flap", "classic flap|11.12", 0, undefined, "[L6] [L7]", "fixed"), preset("chanel_lv", "กระเป๋า Chanel/LV", "Chanel/LV bag", "chanel|ชาแนล|louis vuitton|หลุยส์|กระเป๋า lv", 5, undefined, "[L1] [L5]"), preset("luxury_bag", "กระเป๋าหรู", "Luxury bag", "กระเป๋าหรู|gucci|prada|dior|ysl|celine|fendi", 10, 35, "[L1]")]),
  group("watches", "นาฬิกา", "Watches", "⌚", "other", "market", "always", [preset("smartwatch", "สมาร์ทวอทช์", "Smartwatch", "สมาร์ทวอทช์|smartwatch|apple watch", 20, 40), preset("dress_watch", "นาฬิกา Rolex เดรส", "Rolex dress watch", "datejust|day-date", 2, undefined, "[W1]"), preset("luxury_watch", "นาฬิกาหรู", "Luxury watch", "rolex|โรเล็กซ์|patek|audemars|นาฬิกาหรู", undefined, undefined, "[W1] [W2]", "market"), preset("watch", "นาฬิกา", "Watch", "omega|cartier|tudor|นาฬิกา|watch", 3, 25, "[W5]")]),
  group("jewelry", "เครื่องประดับ", "Jewelry", "💍", "other", "market", "always", [preset("diamond", "เพชร", "Diamond", "เพชร|diamond", 3, 60, "[DM1] [DM2]"), preset("jewel", "เครื่องประดับ", "Jewelry", "เครื่องประดับ|jewelry|พลอย|ไข่มุก|alhambra|vca", undefined, undefined, "[L1]", "market")]),
  group("collectibles", "ของสะสม", "Collectibles", "🏆", "other", "market", "durable", [preset("sneakers", "สนีกเกอร์", "Sneakers", "sneaker|สนีกเกอร์", 10, 20, "[S1] [S2]"), preset("common_cards", "การ์ดทั่วไป", "Common cards", "การ์ดทั่วไป|common cards|ซองเปิดแล้ว", 30, undefined, "[P1] [P2]"), preset("collectible", "ของสะสม", "Collectible", "ของสะสม|โปเกมอน|pokemon|การ์ดกีฬา|art toy|ฟิกเกอร์|figure|แสตมป์|ไวน์|วิสกี้", undefined, undefined, "[P1] [S1]", "market")]),
  group("amulets", "พระเครื่องและวัตถุมงคล", "Amulets", "🙏", "other", "market", "durable", [preset("amulet", "พระเครื่อง", "Amulet", "พระเครื่อง|พระเก่า|พระใหม่|เครื่องราง|amulet", undefined, undefined, "[M1] [M2]", "market")]),
  group("art_antiques", "ศิลปะและของเก่า", "Art and antiques", "🖼️", "other", "market", "durable", [preset("art", "ศิลปะและของเก่า", "Art and antiques", "ภาพวาด|ประติมากรรม|ของโบราณ|antique|painting|sculpture", undefined, undefined, "[AR1] [AR2]", "market")]),
  group("hobbies_sports", "งานอดิเรกและกีฬา", "Hobbies and sports", "⛺", "other", "declining", "durable", [preset("bicycle", "จักรยาน", "Bicycle", "จักรยาน|bicycle|bike|e-bike", 10, 25, "[B3]"), preset("golf", "ไม้กอล์ฟ", "Golf clubs", "กอล์ฟ|golf", 20, 35, "[Q3]"), preset("sports", "อุปกรณ์กีฬา", "Sports equipment", "ตกปลา|fishing|แคมปิ้ง|camping|ฟิตเนส|fitness|ดำน้ำ|diving", 20)]),
  group("firearms", "อาวุธปืน", "Licensed firearms", "🔫", "other", "declining", "durable", [preset("firearm", "อาวุธปืน", "Licensed firearm", "ปืนพก|ปืนยาว|firearm|rifle|pistol", 3, 20, "[GN1] [GN2] [GN3]")]),
  group("business_inventory", "ธุรกิจและสต็อกสินค้า", "Business and inventory", "🏪", "business", "declining", "durable", [preset("shop_equipment", "อุปกรณ์ร้าน", "Shop equipment", "อุปกรณ์ร้าน|ตู้แช่|pos|แฟรนไชส์|franchise", 20, undefined, "[R1]"), preset("inventory", "สินค้าคงคลัง", "Inventory", "สินค้าคงคลัง|inventory|สต็อกสินค้า", 0, undefined, "[R1]", "fixed")]),
  group("receivables_claims", "ลูกหนี้และสิทธิเรียกร้อง", "Receivables and claims", "💳", "other", "fixed", null, [preset("claim", "สิทธิเรียกร้อง", "Claim", "เงินให้ยืม|เงินมัดจำ|เงินประกันห้อง|receivable", 0, undefined, "L5", "fixed")]),
  group("custom", "หมวดของผู้ใช้เอง", "Custom", "➕", "other", "fixed", null, []),
];

/** Prefer the most specific (longest) keyword; Thai has no word boundaries. */
export function classifyAssetName(text: string): { group: string; subcategory: string } | null {
  const lower = text.toLowerCase();
  let best: { group: string; subcategory: string; length: number } | null = null;
  for (const g of ASSET_GROUPS) for (const p of g.subcategories) for (const word of p.keywords) {
    const matches = /^[a-z0-9 -]+$/.test(word)
      ? new RegExp(`(?:^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z])`, "i").test(lower)
      : lower.includes(word);
    if (matches && word.length > (best?.length ?? 0)) best = { group: g.key, subcategory: p.key, length: word.length };
  }
  return best ? { group: best.group, subcategory: best.subcategory } : null;
}
export function getAssetRule(groupKey: string, subcategory?: string): ValuationRule {
  const g = ASSET_GROUPS.find((g) => g.key === groupKey);
  return g?.subcategories.find((p) => p.key === subcategory) ?? g ?? { mode: "fixed", sourceRefs: [], confidence: "⚠️" };
}
export function groupForAssetType(type: AssetType): string {
  return ({ cash: "cash_deposits", bank: "cash_deposits", savings: "cash_deposits", investment: "market_investments", gold: "precious_metals", crypto: "digital_assets", property: "real_estate", vehicle: "land_vehicles", business: "business_inventory", other: "custom" } satisfies Record<AssetType, string>)[type];
}
