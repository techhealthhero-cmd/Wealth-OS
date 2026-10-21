/** OCR repairs for slip categorization only; preserve displayed/stored party text. */
export function normalizeSlipCategoryText(text: string): string {
  return text.normalize("NFC")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/(?<=[\u0E00-\u0E7F])\s+(?=[\u0E00-\u0E7F])/g, "")
    .replace(/\u0E4D([\u0E48-\u0E4B]?)\u0E32/g, "$1\u0E33")
    .replace(/([\u0E48-\u0E4B])\u0E4D\u0E32/g, "$1\u0E33")
    .replace(/น้ามัน/g, "น้ำมัน")
    .replace(/ป(?:ั[้๊]?|[้๊]ั)ม/g, "ปั๊ม");
}
