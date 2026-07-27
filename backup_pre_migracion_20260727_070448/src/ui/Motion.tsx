"use client";
import type { HTMLMotionProps } from 'framer-motion';
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

type HTMLTag = keyof HTMLElementTagNameMap;

const make = <T extends HTMLTag>(tag: T) => {
  const Component = dynamic(
    () => import('framer-motion').then(mod => ({
      default: (mod.motion as any)[tag],
    })),
    { ssr: true }
  );
  return Component as ComponentType<HTMLMotionProps<T>>;
};

export const MotionDiv     = make('div');
export const MotionMain    = make('main');
export const MotionH1      = make('h1');
export const MotionH2      = make('h2');
export const MotionButton  = make('button');
export const MotionLi      = make('li');
export const MotionSpan    = make('span');
export const MotionP       = make('p');
export const MotionSection = make('section');
export const MotionArticle = make('article');
export const MotionImg     = make('img');
export const MotionA = make('a');