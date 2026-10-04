import { describe, expect, it } from "vitest";

import { categoryEmoji, itemEmoji } from "@/lib/transaction-ui";

describe("itemEmoji — drinks get a drink icon, not the food bowl", () => {
  const food = "utensils";

  it.each([
    ["น้ำมะพร้าว", "🥥"],
    ["ชานมไข่มุก", "🧋"],
    ["ชาไทยเย็น", "🧋"],
    ["กาแฟเย็น", "☕"],
    ["ลาเต้", "☕"],
    ["ชาเขียว", "🍵"],
    ["เบียร์", "🍺"],
    ["นมสด", "🥛"],
    ["โกโก้เย็น", "🥛"],
    ["น้ำเปล่า", "💧"],
    ["น้ำส้มคั้น", "🧃"],
    ["น้ำแตงโมปั่น", "🧃"],
    ["โค้ก", "🥤"],
    ["น้ำลำไย", "🥤"],
    ["Iced latte", "☕"],
    ["bottled water", "💧"],
  ])("%s → %s", (text, emoji) => {
    expect(itemEmoji(text, food)).toBe(emoji);
  });

  it("keeps the food icon for food, including tricky look-alikes", () => {
    for (const text of ["กะเพราหมึกไข่ดาว", "ปีกไก่ทอด", "ชาบู", "น้ำพริกปลาทู", "น้ำตกหมู", "steak", "watermelon", "นมปัง"]) {
      expect(itemEmoji(text, food)).toBe(categoryEmoji(food));
    }
  });

  it("never turns a non-food category into a drink (water bill, fuel)", () => {
    expect(itemEmoji("ค่าน้ำ", "plug-zap")).toBe(categoryEmoji("plug-zap"));
    expect(itemEmoji("น้ำมัน", "car")).toBe(categoryEmoji("car"));
    expect(itemEmoji("น้ำมัน", food)).toBe(categoryEmoji(food));
    expect(itemEmoji("กาแฟ", "shopping-bag")).toBe(categoryEmoji("shopping-bag"));
  });

  it("refines uncategorized items too, and falls back cleanly", () => {
    expect(itemEmoji("น้ำมะพร้าว", null)).toBe("🥥");
    expect(itemEmoji("", food)).toBe(categoryEmoji(food));
    expect(itemEmoji(null, null)).toBe(categoryEmoji(null));
  });
});
