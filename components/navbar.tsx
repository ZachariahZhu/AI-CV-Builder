"use client";

import { FileText, Menu } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { type Locale, locales, setUserLocale } from "@/lib/i18n";

interface NavbarProps {
  onMenuToggle: () => void;
}

export function Navbar({ onMenuToggle }: NavbarProps) {
  const currentLocale = useLocale() as Locale;
  const tNav = useTranslations("Nav");
  const tLang = useTranslations("Lang");

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-[#ebebeb] bg-white/80 px-4 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-2.5">
        <button
          onClick={onMenuToggle}
          className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-[#666666] transition-colors hover:bg-[#f5f5f7] hover:text-[#111111] md:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#111111]">
          <FileText className="h-4 w-4 text-white" />
        </div>
        <span className="text-[17px] font-semibold tracking-tight text-[#111111]">
          {tNav("logo")}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {locales.map((l) => (
          <Button
            key={l}
            variant={currentLocale === l ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              if (l !== currentLocale) setUserLocale(l);
            }}
            className={`rounded-full px-2.5 text-[12px] font-medium transition-all sm:px-3.5 sm:text-[13px] ${
              currentLocale === l
                ? "bg-[#f5f5f7] text-[#111111]"
                : "text-[#666666] hover:text-[#111111]"
            }`}
          >
            {tLang(l)}
          </Button>
        ))}
      </div>
    </header>
  );
}
