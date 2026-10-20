/**
 * SAMPLE DATA ONLY — used by the dev preview route and tests. Never import
 * this from production code paths.
 */
import type {
  MonthlySpendSummary,
  SlipCategoryOption,
  SlipReadingViewModel,
  SlipReviewItemVM,
  SlipReviewViewModel,
  SlipSavedViewModel,
} from "../types";

export const sampleCategories: SlipCategoryOption[] = [
  { id: "food", label: "อาหาร", icon: "food", direction: "expense" },
  { id: "go", label: "เดินทาง", icon: "go", direction: "expense" },
  { id: "bills", label: "บิล/ค่าบ้าน", icon: "home", direction: "expense" },
  { id: "shop", label: "ช้อปปิ้ง", icon: "shop", direction: "expense" },
  { id: "other", label: "อื่นๆ", icon: "other", direction: "expense" },
  { id: "design", label: "งานออกแบบ", icon: "income", direction: "income" },
  { id: "tutor", label: "งานสอนพิเศษ", icon: "income", direction: "income" },
];

const ex = (
  id: string,
  title: string,
  dateLabel: string,
  baht: number,
  categoryId: string,
  categoryLabel: string,
  icon: SlipReviewItemVM["icon"],
  confidence: number
): SlipReviewItemVM => ({
  id,
  title,
  dateLabel,
  direction: "expense",
  amountCents: baht * 100,
  categoryId,
  categoryLabel,
  icon,
  confidence,
});

export const sampleReview: SlipReviewViewModel = {
  monthLabel: "ตุลาคม 2569",
  foundCount: 12,
  expense: { count: 9, totalCents: 628700 },
  income: { count: 2, totalCents: 930000 },
  categories: sampleCategories,
  questions: [
    {
      id: "q1",
      verb: "โอน",
      amountCents: 150000,
      whoLabel: "ให้น้องเมย์",
      context: "ธนาคารกสิกร · 19 ต.ค.",
      options: [
        { id: "expense", label: "ค่าใช้จ่าย" },
        { id: "loan", label: "ให้ยืม", hint: "ทวงคืนได้" },
        { id: "fee", label: "ค่าจ้างงาน" },
      ],
    },
    {
      id: "q2",
      verb: "จ่าย",
      amountCents: 4500,
      whoLabel: "ให้ร้านค้า QR ไม่มีชื่อ",
      context: "พร้อมเพย์ · 20 ต.ค.",
      options: [
        { id: "food", label: "อาหาร" },
        { id: "go", label: "เดินทาง" },
        { id: "other", label: "อื่นๆ" },
      ],
    },
  ],
  ready: [
    ex("r1", "7-Eleven", "21 ต.ค.", 89, "food", "อาหาร", "food", 0.96),
    ex("r2", "ข้าวมันไก่", "21 ต.ค.", 60, "food", "อาหาร", "food", 0.92),
    ex("r3", "Grab", "21 ต.ค.", 145, "go", "เดินทาง", "go", 0.94),
    ex("r4", "BTS", "20 ต.ค.", 59, "go", "เดินทาง", "go", 0.97),
    ex("r5", "ค่าเน็ต AIS", "18 ต.ค.", 599, "bills", "บิล/ค่าบ้าน", "home", 0.95),
    ex("r6", "Shopee", "17 ต.ค.", 1290, "shop", "ช้อปปิ้ง", "shop", 0.88),
    ex("r7", "ค่าห้อง", "15 ต.ค.", 2500, "bills", "ค่าบ้าน", "home", 0.9),
    {
      id: "r8",
      title: "รับจาก บจก.ดีไซน์ดี ชื่อยาวมากๆ เพื่อทดสอบการตัดข้อความ",
      dateLabel: "16 ต.ค.",
      direction: "income",
      amountCents: 850000,
      categoryId: "design",
      categoryLabel: "งานออกแบบ",
      icon: "income",
      confidence: 0.93,
    },
    {
      id: "r9",
      title: "รับจาก คุณต่อ",
      dateLabel: "14 ต.ค.",
      direction: "income",
      amountCents: 80000,
      categoryId: "tutor",
      categoryLabel: "งานสอนพิเศษ",
      icon: "income",
      confidence: 0.85,
    },
  ],
  duplicates: [{ id: "d1", title: "Grab", amountCents: 14500, direction: "expense", dateLabel: "20 ต.ค." }],
};

export const sampleReading: SlipReadingViewModel = {
  total: 12,
  done: 8,
  thumbs: [
    { id: "t1", status: "done", tint: "#2f9e5b", amountLabel: "89" },
    { id: "t2", status: "done", tint: "#2aa3dc", amountLabel: "60" },
    { id: "t3", status: "done", tint: "#5b3a8e", amountLabel: "145" },
    { id: "t4", status: "done", tint: "#1e3a8a", amountLabel: "59" },
    { id: "t5", status: "done", tint: "#2f9e5b", amountLabel: "599" },
    { id: "t6", status: "done", tint: "#e8742a", amountLabel: "1,290" },
    { id: "t7", status: "done", tint: "#e3a21f", amountLabel: "2,500" },
    { id: "t8", status: "done", tint: "#2aa3dc", amountLabel: "8,500", direction: "income" },
    { id: "t9", status: "reading", tint: "#5b3a8e" },
    { id: "t10", status: "waiting", tint: "#2f9e5b" },
    { id: "t11", status: "waiting", tint: "#1e3a8a" },
    { id: "t12", status: "waiting", tint: "#e8742a" },
  ],
  recent: [
    { id: "l1", title: "รับจาก บจก.ดีไซน์ดี", categoryLabel: "งานออกแบบ", direction: "income", amountCents: 850000 },
    { id: "l2", title: "ค่าห้อง", categoryLabel: "ค่าบ้าน", direction: "expense", amountCents: 250000 },
    { id: "l3", title: "Shopee", categoryLabel: "ช้อปปิ้ง", direction: "expense", amountCents: 129000 },
  ],
};

export const sampleSaved: SlipSavedViewModel = {
  savedCount: 11,
  duplicateCount: 1,
  monthLabel: "ตุลาคม 2569",
  monthSpentCents: 1842000,
  batchSpentCents: 628700,
  monthIncomeCents: 3260000,
  monthLeftCents: 1418000,
  segments: [
    { id: "a", percent: 33 },
    { id: "b", percent: 29 },
    { id: "c", percent: 16 },
    { id: "d", percent: 13 },
    { id: "e", percent: 9 },
  ],
};

export const sampleMonth: MonthlySpendSummary = {
  monthShortLabel: "ตุลาคม",
  monthLabel: "ตุลาคม 2569",
  spentCents: 1842000,
  incomeCents: 3260000,
  leftCents: 1418000,
  insight: "อาหารมากกว่าเดือนก่อน ฿1,200 — ส่วนใหญ่มื้อเย็นเดลิเวอรี่",
  canGoPrev: true,
  canGoNext: false,
  categories: [
    { id: "home", label: "ค่าบ้าน", icon: "home", amountCents: 610000, percent: 33 },
    {
      id: "food",
      label: "อาหาร",
      icon: "food",
      amountCents: 532000,
      percent: 29,
      items: [
        { id: "i1", title: "7-Eleven", dateLabel: "21 ต.ค.", amountCents: 8900 },
        { id: "i2", title: "ข้าวมันไก่", dateLabel: "21 ต.ค.", amountCents: 6000 },
        { id: "i3", title: "Grab Food · มื้อเย็น", dateLabel: "19 ต.ค.", amountCents: 42000 },
      ],
    },
    { id: "go", label: "เดินทาง", icon: "go", amountCents: 287000, percent: 16 },
    { id: "shop", label: "ช้อปปิ้ง", icon: "shop", amountCents: 234000, percent: 13 },
    { id: "other", label: "อื่นๆ", icon: "other", amountCents: 179000, percent: 9 },
  ],
};
