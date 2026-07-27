"use client";
import type { LucideProps } from "lucide-react";
import Link from "next/link";
import React from "react";

import { MotionDiv } from '@/ui/Motion';
import { useTheme } from "@/providers/ThemeProvider";

interface MenuCardProps {
  href: string;
  title: string;
  icon: React.ReactElement<LucideProps>;
  delay?: number;
  hasNewContent?: boolean;
  onClick?: () => void;
  horizontal?: boolean;
}

export const MenuCard = ({
  href,
  title,
  icon,
  delay = 0,
  hasNewContent,
  onClick,
  horizontal = false,
}: MenuCardProps) => {
  const { theme: _theme } = useTheme();

  return (
    <MotionDiv
      animate={{ opacity: 1, y: 0 }}
      className={horizontal ? undefined : "flex-1 min-h-0"}
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay, type: "spring", stiffness: 100 }}
    >
      <Link
        className={`group block relative ${horizontal ? "" : "h-full"}`}
        href={href}
        onClick={onClick}
      >
        <div
          className={`card-main transition-all duration-500 group-hover:border-primary group-hover:shadow-[0_30px_70px_rgba(0,0,0,0.15)] ${
            horizontal
              ? "flex flex-row items-center gap-4 px-6 py-4 group-hover:-translate-y-1"
              : "h-full p-4 md:p-6 flex flex-col items-center justify-center text-center group-hover:-translate-y-2"
          }`}
        >
          {hasNewContent && (
            <MotionDiv
              animate={{ scale: 1 }}
              className={`absolute z-20 bg-red-500 rounded-full shadow-lg ${
                horizontal
                  ? "top-3 right-3 w-3 h-3"
                  : "top-3 right-3 w-3 h-3 md:w-4 md:h-4"
              }`}
              initial={{ scale: 0 }}
            >
              <span
                className={`absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75 ${
                  horizontal ? "w-3 h-3" : "w-3 h-3 md:w-4 md:h-4"
                }`}
              />
            </MotionDiv>
          )}

          <MotionDiv
            className={`text-primary flex items-center justify-center transition-all duration-300 shrink-0 opacity-80 group-hover:opacity-100 ${
              horizontal ? "w-16 h-16" : "w-10 h-10 md:w-16 md:h-16 mb-3 md:mb-4"
            }`}
            whileHover={{ rotate: [0, -10, 10, 0] }}
          >
            {React.cloneElement(icon, {
              size: horizontal ? 32 : 24,
              className: horizontal ? undefined : "md:w-[36px] md:h-[36px]",
            })}
          </MotionDiv>

          <h2
            className={`font-black uppercase tracking-tighter text-primary ${
              horizontal ? "text-2xl" : "text-lg md:text-2xl lg:text-3xl"
            }`}
          >
            {title}
          </h2>
        </div>
      </Link>
    </MotionDiv>
  );
};