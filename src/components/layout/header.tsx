"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings, User } from "lucide-react";

import { logout } from "@/features/auth/actions";
import { asTrigger } from "@/lib/as-trigger";
import { useTranslation } from "@/i18n/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BrandMark } from "@/components/illustrations";

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Header({
  displayName,
  actions,
}: {
  displayName: string | null | undefined;
  /** Server-rendered slot (notification bell, plan badge, ...) — passed in from the (app) layout, a Server Component, since this file is a Client Component and can't import async Server Components directly. */
  actions?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const compactGreeting = displayName
    ? t("dashboard.greetingCompact").replace("{name}", displayName)
    : t("dashboard.greetingGenericCompact");

  return (
    <header className="flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-1 border-b px-4 pt-[env(safe-area-inset-top)]">
      {isDashboard ? (
        <div className="flex min-w-0 items-center gap-2 text-primary md:hidden">
          <BrandMark size={30} />
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{compactGreeting}</h1>
        </div>
      ) : null}
      <div className="ml-auto flex items-center gap-1">
        {actions}
        <span className={isDashboard ? "hidden md:inline-flex" : "inline-flex"}>
          <ThemeToggle />
        </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          {...asTrigger(
            <Button variant="ghost" className={isDashboard ? "hidden gap-2 px-2 md:flex" : "gap-2 px-2"}>
              <Avatar className="h-7 w-7">
                <AvatarFallback>{initials(displayName)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">
                {displayName ?? "Account"}
              </span>
            </Button>
          )}
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href="/profile" />}>
            <User className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("nav.profile")}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/profile" />}>
            <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("nav.settings")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("nav.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}
