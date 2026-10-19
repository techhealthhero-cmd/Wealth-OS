import type { InvoiceView } from "@/features/invoices/ui-logic";
export const invoice: InvoiceView = {
  id: "11111111-1111-4111-8111-111111111111",
  invoiceNumber: "INV-2569-017",
  clientName: "Studio Mango",
  clientIsCompany: true,
  issueDate: "2026-10-01",
  dueDate: "2026-10-05",
  status: "sent",
  displayStatus: "overdue",
  paidAt: null,
  daysOverdue: 14,
  withholdingRatePct: 3,
  netReceivableCents: 1940000,
  receiveAccountId: "22222222-2222-4222-8222-222222222222",
  receiveAccountName: "SCB ออมทรัพย์",
  notes: "ขอบคุณที่ไว้วางใจ",
  items: [
    { description: "ออกแบบโลโก้", quantity: 1, unitPriceCents: 1500000 },
    { description: "แก้ไขงาน", quantity: 2.5, unitPriceCents: 200000 },
  ],
};
