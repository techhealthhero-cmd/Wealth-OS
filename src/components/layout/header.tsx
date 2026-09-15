"use client";

import Link from "next/link";
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

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Header({ displayName }: { displayName: string | null | undefined }) {
  const { t } = useTranslation();

  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-1 border-b px-4">
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger
          {...asTrigger(
            <Button variant="ghost" className="gap-2 px-2">
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
    </header>
  );
}
