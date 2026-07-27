"use client";
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import React from 'react';

import { AdminControls } from './components/AdminControls'; 
import { ShareButton } from './components/ShareButton'; 
import { Thumbnails } from './components/Thumbnails'; 
import { useLightbox } from './LightboxProvider';

export default function LightboxVisual() {
  const { selectedImg, gallery, currentIndex, setCurrentIndex, closeLightbox, tableContext } = useLightbox();

  if (!selectedImg) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black overflow-y-auto no-scrollbar">
      <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl -z-10" />

      <header className="sticky top-0 w-full p-6 md:px-10 flex justify-between items-center z-[110] bg-black/80 backdrop-blur-md border-b border-white/5">
        <div className="flex flex-col flex-1 mr-4">
          <AdminControls />
          <span className="text-white/30 text-micro font-mono mt-1 uppercase tracking-widest">
            {tableContext} | {currentIndex + 1} de {gallery.length}
          </span>
        </div>
        
        <div className="flex items-center gap-4 md:gap-8">
          <ShareButton titulo={selectedImg.alt} url={selectedImg.src} />
          <button className="text-white/40 hover:text-white transition-all hover:rotate-90 duration-300" onClick={closeLightbox}>
            <X size={32} strokeWidth={1} />
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row w-full max-w-[2000px] mx-auto flex-1">
        <div className="flex-1 flex flex-col items-center w-full lg:border-r lg:border-white/5 relative justify-center min-h-[70vh]">
          
          <button className="absolute left-4 md:left-8 z-[105] text-white/20 hover:text-white hidden md:block"
            onClick={() => setCurrentIndex((currentIndex - 1 + gallery.length) % gallery.length)}>
            <ChevronLeft size={80} strokeWidth={1} />
          </button>

          <img 
            key={selectedImg.src} 
            alt={selectedImg.alt} 
            className="max-h-[75vh] md:max-h-[80vh] object-contain shadow-2xl animate-in zoom-in-95 duration-500" 
            src={selectedImg.src} 
          />

          <button className="absolute right-4 md:right-8 z-[105] text-white/20 hover:text-white hidden md:block"
            onClick={() => setCurrentIndex((currentIndex + 1) % gallery.length)}>
            <ChevronRight size={80} strokeWidth={1} />
          </button>
        </div>

        <Thumbnails />
      </div>
    </div>
  );
}
