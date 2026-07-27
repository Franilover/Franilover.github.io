"use client";
import { Share2 } from 'lucide-react';
import React, { useState } from 'react';

export const ShareButton = ({ url, titulo }: { url: string; titulo: string }) => {
  const [copiado, setCopiado] = useState(false);
  
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation(); 
    
    const fullUrl = typeof window !== 'undefined' 
      ? window.location.origin + url 
      : url;

    if (navigator.share) {
      try { 
        await navigator.share({ 
          title: titulo || "Franilover Art", 
          url: fullUrl 
        }); 
      } catch (err) {
        console.error("Error compartiendo:", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(fullUrl);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      } catch (_err) {
        console.error("No se pudo copiar al portapapeles");
      }
    }
  };

  return (
    <button 
      className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full transition-all active:scale-95 group" 
      onClick={handleShare}
    >
      <span className="text-white text-micro font-black uppercase tracking-[0.2em]">
        {copiado ? "¡Enlace Copiado!" : "Compartir"}
      </span>
      <Share2 className="text-white opacity-50 group-hover:opacity-100" size={12} />
    </button>
  );
};
