import type { Metadata } from "next";

import { AssetList } from "@/features/assets/components/asset-list";

export const metadata: Metadata = { title: "Assets — Wealth OS" };

export default function AssetsPage() {
  return <AssetList />;
}
