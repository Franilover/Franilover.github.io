"use client";
import type { LucideProps } from "lucide-react";
import React, { useEffect, useState } from "react";

import { MenuCard } from "@/components/layout/MenuCard";
import { MotionDiv } from '@/components/ui/Motion';
import { supabase } from "@/infra/supabase/supabase";

export interface MenuBaseItem {
  href: string;
  title: string;
  icon: React.ReactElement<LucideProps>;
  pageKey: string;
  delay?: number;
}

interface MenuBaseProps {
  titulo: string;
  items: MenuBaseItem[];
}

export default function MenuBase({ titulo, items }: MenuBaseProps) {
  const [notifications, setNotifications] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const pageKeys = items.map(i => i.pageKey);
    supabase
      .from("wiki_notifications")
      .select("page_name, has_new_content")
      .in("page_name", pageKeys)
      .then(({ data }) => {
        if (!data) return;
        const mapped = data.reduce((acc: Record<string, boolean>, curr) => {
          acc[curr.page_name] = curr.has_new_content;
          return acc;
        }, {});
        setNotifications(mapped);
      });
  }, []);

  const handleVisit = async (pageKey: string) => {
    if (!notifications[pageKey]) return;
    await supabase
      .from("wiki_notifications")
      .update({ has_new_content: false })
      .eq("page_name", pageKey);
    setNotifications(prev => ({ ...prev, [pageKey]: false }));
  };

  return (
    <div
      className="flex flex-col justify-center md:justify-start p-4 md:p-8 gap-6 md:gap-8"
      style={{ height: "calc(100svh - 64px)" }}
    >
      <MotionDiv
        animate={{ opacity: 1, y: 0 }}
        className="text-center shrink-0 md:pt-10"
        initial={{ opacity: 0, y: -30 }}
      >
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter text-primary italic">
          {titulo}
        </h1>
      </MotionDiv>

      {}
      <div className="hidden md:grid grid-cols-2 gap-4 lg:gap-6 flex-1 min-h-0">
        {items.map(({ href, title, icon, pageKey, delay = 0 }) => (
          <MenuCard
            key={href}
            delay={delay}
            hasNewContent={notifications[pageKey]}
            href={href}
            icon={icon}
            title={title}
            onClick={() => handleVisit(pageKey)}
          />
        ))}
      </div>

      {}
      <div className="flex flex-col gap-3 shrink-0 md:hidden">
        {items.map(({ href, title, icon, pageKey, delay = 0 }) => (
          <MenuCard
            key={href}
            horizontal
            delay={delay}
            hasNewContent={notifications[pageKey]}
            href={href}
            icon={icon}
            title={title}
            onClick={() => handleVisit(pageKey)}
          />
        ))}
      </div>
    </div>
  );
}