/** Thai cardinal amounts; require a token boundary so names are never rewritten. */
export function normalizeThaiAmounts(text: string): string {
  const digits: Record<string, number> = { ศูนย์: 0, หนึ่ง: 1, เอ็ด: 1, สอง: 2, ยี่: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9 };
  const scales: Record<string, number> = { สิบ: 10, ร้อย: 100, พัน: 1000, หมื่น: 10000, แสน: 100000, ล้าน: 1000000 };
  const token = Object.keys({ ...digits, ...scales }).join('|');
  return text.replace(new RegExp(`(^|\\s)((?:${token})+)(?=บาท|\\s|$)`, 'g'), (original, prefix: string, words: string, offset: number) => {
    if (/\d\s*$/.test(text.slice(0, offset))) return original;
    // Bare words such as หก (spill) and แสน (a name) are not amounts.
    // A following numeric price also makes this token part of the label.
    const after = text.slice(offset + original.length);
    if (!/^\s*บาท/.test(after) && (!/สิบ|ร้อย|พัน|หมื่น|แสน|ล้าน/.test(words) || Object.hasOwn(scales, words) || /^\s+\d/.test(after))) return original;
    const parts = words.match(new RegExp(token, 'g'))!;
    let total = 0, pending: number | null = null, lastScale = 1;
    for (const part of parts) {
      if (part in digits) pending = digits[part];
      else {
        lastScale = scales[part];
        if (lastScale === 1000000) total = (total + (pending ?? 0) || 1) * lastScale;
        else total += (pending ?? 1) * lastScale;
        pending = null;
      }
    }
    // Colloquial หมื่นสอง / สองพันห้า: omitted next magnitude.
    total += (pending ?? 0) * (lastScale >= 1000 ? lastScale / 10 : 1);
    return total > 0 ? `${prefix}${total}` : original;
  });
}
