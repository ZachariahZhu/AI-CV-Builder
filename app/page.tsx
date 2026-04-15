"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Shield, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";

const featureIcons = [Sparkles, Zap, Shield];
const featureKeys = ["feature1", "feature2", "feature3"] as const;

export default function Home() {
  const [activeItem, setActiveItem] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const t = useTranslations("Home");

  return (
    <div className="min-h-screen bg-white">
      <Navbar onMenuToggle={() => setSidebarOpen((v) => !v)} />
      <Sidebar
        activeItem={activeItem}
        onItemChange={setActiveItem}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="pt-14 md:ml-60">
        <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-6 py-16 md:px-16 md:py-24">
          <div className="flex max-w-2xl flex-col items-center text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#f5f5f7] px-4 py-1.5 text-[13px] font-medium text-[#666666]">
              <Sparkles className="h-3.5 w-3.5" />
              {t("badge")}
            </div>

            <h1 className="mb-5 text-[28px] font-bold leading-[1.15] tracking-tight text-[#111111] md:text-[42px]">
              {t("title")}
            </h1>

            <p className="mb-10 max-w-lg text-[15px] leading-relaxed text-[#666666] md:text-[17px]">
              {t("subtitle")}
            </p>

            <Link href="/builder">
              <Button
                size="lg"
                className="group h-12 rounded-full bg-[#111111] px-8 text-[15px] font-medium text-white shadow-none transition-all hover:bg-[#333333]"
              >
                {t("cta")}
                <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </div>

          <div className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-5 sm:grid-cols-3 md:mt-20">
            {featureKeys.map((key, i) => {
              const Icon = featureIcons[i];
              return (
                <Card
                  key={key}
                  className="border-0 bg-[#f5f5f7]/60 shadow-none transition-all hover:bg-[#f0f0f2]"
                >
                  <CardContent className="flex flex-col items-center gap-3 px-6 py-8 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm">
                      <Icon
                        className="h-5 w-5 text-[#111111]"
                        strokeWidth={1.6}
                      />
                    </div>
                    <h3 className="text-[15px] font-semibold text-[#111111]">
                      {t(`${key}Title`)}
                    </h3>
                    <p className="text-[13px] leading-relaxed text-[#666666]">
                      {t(`${key}Desc`)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
