"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Upload, FileText, Clock, Settings, X } from "lucide-react";
import { useTranslations } from "next-intl";

interface SidebarProps {
  activeItem?: string;
  onItemChange?: (item: string) => void;
  open: boolean;
  onClose: () => void;
  onApiConfig?: () => void;
}

const menuItems = [
  { key: "home", href: "/", icon: Home },
  { key: "upload", href: "/builder", icon: Upload },
  { key: "generate", href: "/builder", icon: FileText },
  { key: "history", href: "/history", icon: Clock },
] as const;

export function Sidebar({ activeItem, onItemChange, open, onClose, onApiConfig }: SidebarProps) {
  const t = useTranslations("Sidebar");
  const pathname = usePathname();

  function resolveActive(key: string, href: string) {
    if (activeItem) return activeItem === key;
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-14 bottom-0 z-40 flex w-60 flex-col border-r border-[#ebebeb] bg-[#fafafa]/95 backdrop-blur-xl transition-transform duration-300 ease-out md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-end px-3 pt-3 md:hidden">
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#666666] transition-colors hover:bg-white/60 hover:text-[#111111]"
            aria-label="Close menu"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 pt-3 md:pt-6">
          {menuItems.map(({ key, href, icon: Icon }) => {
            const isActive = resolveActive(key, href);

            return (
              <Link
                key={key}
                href={href}
                onClick={() => {
                  onItemChange?.(key);
                  onClose();
                }}
                className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] font-medium transition-all ${
                  isActive
                    ? "bg-white text-[#111111] shadow-sm"
                    : "text-[#666666] hover:bg-white/60 hover:text-[#111111]"
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] transition-colors ${
                    isActive
                      ? "text-[#111111]"
                      : "text-[#999999] group-hover:text-[#666666]"
                  }`}
                  strokeWidth={1.8}
                />
                {t(key)}
              </Link>
            );
          })}

          {/* Spacer to push API config to bottom */}
          <div className="flex-1" />

          {/* Divider + API config */}
          <div className="mb-4">
            <div className="mx-1 mb-2 h-px bg-[#ebebeb]" />
            <button
              type="button"
              onClick={() => {
                onApiConfig?.();
                onClose();
              }}
              className="group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] font-medium text-[#666666] transition-all hover:bg-white/60 hover:text-[#111111]"
            >
              <Settings
                className="h-[18px] w-[18px] text-[#999999] transition-colors group-hover:text-[#666666]"
                strokeWidth={1.8}
              />
              {t("apiConfig")}
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
}
