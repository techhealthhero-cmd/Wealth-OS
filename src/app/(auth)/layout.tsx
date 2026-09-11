import { BrandMark } from "@/components/illustrations";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-2 text-lg font-semibold text-primary">
          <BrandMark size={24} />
          <span className="text-foreground">Wealth OS</span>
        </div>
        {children}
      </div>
    </div>
  );
}
