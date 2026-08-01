import { MessageCircle } from 'lucide-react';
import BibliotecaMensajes from '@/domains/personal/mensajes/bibliotecaMensajes';

export default function Page() {
  return (
    <>
      {/* Mobile: lista de conversaciones a pantalla completa (la sidebar
          del layout está oculta en mobile, así que esto es lo único que se ve). */}
      <div className="md:hidden">
        <BibliotecaMensajes />
      </div>

      {/* Desktop: la sidebar del layout ya muestra la lista, así que acá
          solo mostramos el placeholder de "elegí una conversación". */}
      <div className="hidden md:flex md:h-full md:flex-col md:items-center md:justify-center gap-3 text-center px-6">
        <MessageCircle className="text-primary/20" size={48} />
        <p className="text-primary/30 font-black uppercase text-xs tracking-widest italic">
          Elegí una conversación para empezar a chatear
        </p>
      </div>
    </>
  );
}
