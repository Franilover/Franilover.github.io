"use client";
import React, { createContext, useContext, useState, useCallback } from 'react';

export type GalleryImage = {
  id?: string;
  src: string;
  alt: string;
};

type LightboxContextType = {
  selectedImg: GalleryImage | undefined;
  gallery: GalleryImage[];
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  openLightbox: (index: number, images: GalleryImage[], table?: string) => void;
  closeLightbox: () => void;
  updateGalleryItem: (index: number, newTitle: string) => void;
  tableContext: string;
};

const LightboxContext = createContext<LightboxContextType | null>(null);

export const useLightbox = (): LightboxContextType => {
  const context = useContext(LightboxContext);
  if (!context) throw new Error("useLightbox debe usarse dentro de LightboxProvider");
  return context;
};

export const LightboxProvider = ({ children }: { children: React.ReactNode }) => {
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [tableContext, setTableContext] = useState('dibujos');

  const openLightbox = useCallback((index: number, images: GalleryImage[], table = 'dibujos') => {
    setGallery(images);
    setCurrentIndex(index);
    setTableContext(table);
    if (typeof window !== 'undefined') document.body.style.overflow = 'hidden';
  }, []);

  const closeLightbox = useCallback(() => {
    setCurrentIndex(-1);
    setGallery([]);
    if (typeof window !== 'undefined') document.body.style.overflow = 'auto';
  }, []);

  const updateGalleryItem = useCallback((index: number, newTitle: string) => {
    setGallery(prev => {
      const newGallery = [...prev];
      newGallery[index] = { ...newGallery[index], alt: newTitle };
      return newGallery;
    });
  }, []);

  return (
    <LightboxContext.Provider value={{ 
      selectedImg: gallery[currentIndex], 
      gallery, currentIndex, setCurrentIndex, 
      openLightbox, closeLightbox, updateGalleryItem, tableContext 
    }}>
      {children}
    </LightboxContext.Provider>
  );
};
