import { InvoiceRouteScreen } from "@/features/invoices/route-screen";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ share?: string }>;
}) {
  const { id } = await params;
  const { share } = await searchParams;
  return <InvoiceRouteScreen mode="detail" id={id} share={share === "1"} />;
}
