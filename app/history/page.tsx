"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";

export default function HistoryPage() {
  const t = useTranslations("History");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <Navbar onMenuToggle={() => setSidebarOpen((v) => !v)} />
      <Sidebar
        activeItem="history"
        onItemChange={() => {}}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="pt-14 md:ml-60">
        <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-6 py-16">
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f5f5f7]">
              <Clock className="h-7 w-7 text-[#999999]" strokeWidth={1.6} />
            </div>
            <h1 className="text-[22px] font-bold tracking-tight text-[#111111] md:text-[28px]">
              {t("title")}
            </h1>
            <p className="max-w-sm text-[15px] leading-relaxed text-[#999999]">
              {t("subtitle")}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
