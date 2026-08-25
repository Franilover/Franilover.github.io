"use client";
import { AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CircleUser,
  Clock,
  Flower2,
  PenTool,
  Moon,
  Sun,
  Star,
  Palette,
  Compass,
  BookText,
  BookOpen,
  ChevronRight,
  Cat,
  Home,
  Mountain,
  Search,
  SlidersHorizontal,
  MessageCircle,
  ScrollText,
  Music,
  Users,
  Utensils,
  Wheat,
  Dumbbell,
  Shirt,
  Upload,
  Wand2,
  ClipboardCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";

import { useCommandPalette } from "@/ui/command";
import { MotionDiv } from "@/ui/Motion";
import {
  useMundoNavigation,
  type SectionKey,
} from "@/domains/garlia/_shared/useMundoNavigationStore";
import { useEscritorioNavigation } from "@/editor/notas/hooks/useEscritorioNavigationStore";
import { useGotoHotkeys } from "@/hooks/ui/useGotoHotkeys";
import { useMobileAsidePanel } from "@/hooks/ui/useMobileAsidePanel";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme, ThemeSelector } from "@/providers/ThemeProvider";


// ── Shared types ─────────────────────────────────────────────────────────────

interface NavLinkDef {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  fillActive?: boolean;
  onSelect?: () => void;
}

// ── Shared constants ──────────────────────────────────────────────────────────

const navItemBase = {
  height: "36px",
  borderRadius: "var(--radius-btn)",
  paddingLeft: "8px",
} as const;

const submenuSurface = {
  background: "var(--white-custom)",
  border:
    "var(--border-width) solid color-mix(in srgb, var(--primary) 15%, transparent)",
  borderRadius: "var(--radius-card)",
  boxShadow: "var(--shadow-card)",
} as const;

const flyoutVariants = {
  hidden: { opacity: 0, x: -8, scale: 0.97 },
  visible: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -8, scale: 0.97 },
};

const OUTLINE_THEMES = new Set(["pixel", "slate", "sepia"]);

// ── Shared style helpers ──────────────────────────────────────────────────────

function hoverIn(e: React.MouseEvent, active: boolean) {
  const el = e.currentTarget as HTMLElement;
  if (!active)
    el.style.background = "color-mix(in srgb, var(--primary) 6%, transparent)";
  el.style.color = "var(--primary)";
}

function hoverOut(e: React.MouseEvent, active: boolean) {
  const el = e.currentTarget as HTMLElement;
  if (!active) el.style.background = "transparent";
  el.style.color = active
    ? "var(--primary)"
    : "color-mix(in srgb, var(--primary) 40%, transparent)";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NavDivider({ margin = "6px 4px" }: { margin?: string }) {
  return (
    <div
      style={{
        height: "var(--border-width)",
        background: "color-mix(in srgb, var(--primary) 12%, transparent)",
        margin,
      }}
    />
  );
}

function NavVerticalDivider() {
  return (
    <div
      style={{
        width: "var(--border-width)",
        alignSelf: "stretch",
        background: "color-mix(in srgb, var(--primary) 12%, transparent)",
        margin: "4px 2px",
      }}
    />
  );
}

function SubItemLabel({
  active,
  icon: Icon,
  label,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <>
      <Icon size={13} strokeWidth={active ? 2.5 : 2} />
      {label}
    </>
  );
}

function SideSubItem({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      className="flex items-center gap-3 px-3 py-2 text-micro font-black uppercase tracking-widest transition-all"
      href={href}
      style={{
        borderRadius: "var(--radius-btn)",
        background: active
          ? "color-mix(in srgb, var(--primary) 8%, transparent)"
          : "transparent",
        color: active
          ? "var(--primary)"
          : "color-mix(in srgb, var(--primary) 60%, transparent)",
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.background =
          "color-mix(in srgb, var(--primary) 6%, transparent)";
        el.style.color = "var(--primary)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = active
          ? "color-mix(in srgb, var(--primary) 8%, transparent)"
          : "transparent";
        el.style.color = active
          ? "var(--primary)"
          : "color-mix(in srgb, var(--primary) 60%, transparent)";
      }}
    >
      <SubItemLabel active={active} icon={Icon} label={label} />
    </Link>
  );
}

function SideNavItem({
  href,
  label,
  icon: Icon,
  active,
  fillActive = false,
  subLinks,
  onClose,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  fillActive?: boolean;
  subLinks?: NavLinkDef[];
  onClose: (e?: React.MouseEvent) => void;
}) {
  const currentPath = usePathname();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const hasSublinks = !!subLinks?.length;
  const useOutline = OUTLINE_THEMES.has(theme);

  useEffect(() => {
    setOpen(false);
  }, [currentPath]);

  return (
    <div
      className="relative"
      onMouseEnter={() => hasSublinks && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link
        className="flex items-center gap-3 transition-all duration-200 overflow-hidden"
        href={href}
        style={{
          ...navItemBase,
          paddingRight: "8px",
          background: active
            ? "color-mix(in srgb, var(--primary) 10%, transparent)"
            : "transparent",
          color: active
            ? "var(--primary)"
            : "color-mix(in srgb, var(--primary) 40%, transparent)",
          border:
            useOutline && active
              ? "var(--border-width) solid var(--primary)"
              : "var(--border-width) solid transparent",
        }}
        onClick={onClose}
        onMouseEnter={(e) => hoverIn(e, active)}
        onMouseLeave={(e) => hoverOut(e, active)}
      >
        {active && !useOutline && (
          <span
            className="absolute left-[3px]"
            style={{
              width: "3px",
              height: "20px",
              borderRadius: "0 2px 2px 0",
              background: "var(--primary)",
            }}
          />
        )}
        <span
          className="shrink-0 flex items-center justify-center"
          style={{ width: "22px" }}
        >
          <Icon
            fill={active && fillActive ? "currentColor" : "none"}
            size={15}
            strokeWidth={active ? 2.5 : 2}
          />
        </span>
        {hasSublinks && (
          <ChevronRight
            size={12}
            style={{
              color: "color-mix(in srgb, var(--primary) 30%, transparent)",
              flexShrink: 0,
            }}
          />
        )}
      </Link>

      <AnimatePresence>
        {open && hasSublinks && (
          <MotionDiv
            animate="visible"
            className="absolute top-0 left-full ml-2 z-[1010] p-2 w-44"
            exit="exit"
            initial="hidden"
            style={submenuSurface}
            transition={{ duration: 0.15 }}
            variants={flyoutVariants}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className="text-micro font-black uppercase tracking-widest px-2 pb-1.5"
              style={{
                color: "color-mix(in srgb, var(--primary) 30%, transparent)",
              }}
            >
              {label}
            </p>
            {subLinks!.map(({ href: sub, label: subLabel, icon: SubIcon }) => (
              <SideSubItem
                key={sub}
                active={!!currentPath?.includes(sub.split("?")[0])}
                href={sub}
                icon={SubIcon}
                label={subLabel}
                onClick={() => {
                  setOpen(false);
                  onClose();
                }}
              />
            ))}
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileSubItem({
  href,
  label,
  icon: Icon,
  active,
  onClose,
  onSelect,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClose: () => void;
  onSelect?: () => void;
}) {
  return (
    <Link
      className="flex items-center gap-2.5 px-3 py-2 text-micro font-black uppercase tracking-widest transition-all"
      href={href}
      style={{
        borderRadius: "var(--radius-btn)",
        background: active
          ? "color-mix(in srgb, var(--primary) 8%, transparent)"
          : "transparent",
        color: active
          ? "var(--primary)"
          : "color-mix(in srgb, var(--primary) 60%, transparent)",
      }}
      onClick={() => {
        onSelect?.();
        setTimeout(onClose, 150);
      }}
    >
      <SubItemLabel active={active} icon={Icon} label={label} />
    </Link>
  );
}

function MobileFlatButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const { theme } = useTheme();
  const useOutline = OUTLINE_THEMES.has(theme);

  const style: React.CSSProperties = useOutline
    ? {
        borderRadius: "var(--radius-btn)",
        touchAction: "manipulation",
        border: active
          ? "var(--border-width) solid var(--primary)"
          : "var(--border-width) solid transparent",
        color: active
          ? "var(--primary)"
          : "color-mix(in srgb, var(--primary) 40%, transparent)",
      }
    : {
        borderRadius: "var(--radius-btn)",
        touchAction: "manipulation",
        background: active ? "var(--primary)" : "transparent",
        color: active
          ? "var(--btn-text)"
          : "color-mix(in srgb, var(--primary) 40%, transparent)",
      };

  return (
    <button
      className="flex items-center justify-center transition-all"
      style={{ ...style, width: 36, height: 36 }}
      title={label}
      aria-label={label}
      type="button"
      onClick={onClick}
    >
      <Icon size={16} strokeWidth={active ? 2.5 : 2} />
    </button>
  );
}

function MobileNavItem({
  href,
  label,
  icon: Icon,
  active,
  fillActive = false,
  subLinks,
  isOpen,
  onToggle,
  onClose,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  fillActive?: boolean;
  subLinks?: NavLinkDef[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const currentPath = usePathname();
  const { theme } = useTheme();
  const hasSublinks = !!subLinks?.length;
  const useOutline = OUTLINE_THEMES.has(theme);

  const btnStyle = (
    isActive: boolean,
    menuOpen: boolean,
  ): React.CSSProperties => {
    const base = {
      borderRadius: "var(--radius-btn)",
      touchAction: "manipulation" as const,
    };
    if (useOutline) {
      return {
        ...base,
        border: isActive
          ? "var(--border-width) solid var(--primary)"
          : "var(--border-width) solid transparent",
        background: menuOpen
          ? "color-mix(in srgb, var(--primary) 10%, transparent)"
          : "transparent",
        color:
          isActive || menuOpen
            ? "var(--primary)"
            : "color-mix(in srgb, var(--primary) 40%, transparent)",
      };
    }
    return {
      ...base,
      background: isActive || menuOpen ? "var(--primary)" : "transparent",
      color:
        isActive || menuOpen
          ? "var(--btn-text)"
          : "color-mix(in srgb, var(--primary) 40%, transparent)",
    };
  };

  if (!hasSublinks) {
    return (
      <Link
        className="flex items-center justify-center transition-all"
        href={href}
        style={{ ...btnStyle(active, false), width: 36, height: 36 }}
        onClick={onClose}
      >
        <Icon
          fill={active && fillActive ? "currentColor" : "none"}
          size={16}
          strokeWidth={active ? 2.5 : 2}
        />
      </Link>
    );
  }

  return (
    <div className="relative flex items-stretch">
      <button
        className="flex items-center justify-center transition-all"
        style={{ ...btnStyle(active, isOpen), width: 36, height: 36 }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
      >
        <Icon
          fill={active && fillActive ? "currentColor" : "none"}
          size={16}
          strokeWidth={active ? 2.5 : 2}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <MotionDiv
            animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
            className="absolute bottom-full mb-2 left-1/2 z-[2000] p-2 w-44 origin-bottom"
            exit={{ opacity: 0, y: 8, scale: 0.97, x: "-50%" }}
            initial={{ opacity: 0, y: 8, scale: 0.97, x: "-50%" }}
            style={submenuSurface}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className="text-micro font-black uppercase tracking-widest px-2 pb-1.5"
              style={{
                color: "color-mix(in srgb, var(--primary) 30%, transparent)",
              }}
            >
              {label}
            </p>
            {subLinks!.map(
              ({ href: sub, label: subLabel, icon: SubIcon, onSelect }) => (
                <MobileSubItem
                  key={sub}
                  active={!!currentPath?.includes(sub.split("?")[0])}
                  href={sub}
                  icon={SubIcon}
                  label={subLabel}
                  onClose={onClose}
                  onSelect={onSelect}
                />
              ),
            )}
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const Navbar = () => {
  const currentPath = usePathname();
  const router = useRouter();
  const { user, isAdmin } = useAuth() as { user: any; isAdmin: boolean };
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [mobileOpenMenu, setMobileOpenMenu] = useState<string | null>(null);
  // Submenú admin del sidebar desktop (reemplaza a Personal/Garlia mientras
  // está abierto). Es puramente de UI, no depende de la ruta: se abre al
  // click en "Arte" (antes navegaba directo a /myself/garlia) y se cierra
  // con "Volver al navbar normal" — sin tocar la URL en ningún caso. Si el
  // usuario sale de /myself/garlia por otro medio (ej. navbar mobile), se
  // cierra solo para no quedar en un estado inconsistente.
  const [adminSubmenuOpen, setAdminSubmenuOpen] = useState(false);
  // Submenú de Escritorio (sidebar desktop), mismo patrón que adminSubmenuOpen
  // para "Arte": reemplaza Personal/Garlia mientras está abierto, es puramente
  // de UI (no depende de la ruta) y cambia de sección sin navegar.
  const [escritorioSubmenuOpen, setEscritorioSubmenuOpen] = useState(false);
  const { dark, toggleDark, theme } = useTheme();
  const useOutline = OUTLINE_THEMES.has(theme);
  const isDark = dark === "dark";
  const { setOpen: openPalette } = useCommandPalette();

  // ── Botón de panel lateral (mobile) ───────────────────────────────────────
  // Antes cada editor con aside propio (personajes, criaturas, reinos...)
  // dibujaba su propio botón "sm:hidden" en su header para abrir el drawer.
  // Ahora ese botón vive una sola vez, acá, y solo aparece si hay un editor
  // registrado con panel lateral montado (ver useRegisterMobileAside).
  const asideAvailable = useMobileAsidePanel((s) => s.available);
  const asideOpen = useMobileAsidePanel((s) => s.open);
  const toggleAside = useMobileAsidePanel((s) => s.toggle);

  const closeAll = () => {
    setThemeMenuOpen(false);
    setMobileOpenMenu(null);
  };

  useEffect(() => {
    closeAll();
  }, [currentPath]);

  // ── Route flags ─────────────────────────────────────────────────────────────

  const isEscritorio = currentPath?.startsWith("/myself/escritorio") ?? false;
  const isGarliaeditor = currentPath?.startsWith("/myself/garlia") ?? false;
  const isGarlia = currentPath?.startsWith("/garlia") ?? false;
  const isPersonal = currentPath?.startsWith("/personal") ?? false;
  const personalIsActive = currentPath === "/garlia/personal";

  useEffect(() => {
    setAdminSubmenuOpen(isGarliaeditor);
  }, [isGarliaeditor]);

  useEffect(() => {
    setEscritorioSubmenuOpen(isEscritorio);
  }, [isEscritorio]);

  const escritorioSection = useEscritorioNavigation((s) => s.section);
  const selectEscritorioSection = useEscritorioNavigation(
    (s) => s.selectSection,
  );

  // ── Botón de volver del editor de mundo ──────────────────────────────────
  // Vive en la navbar (no flotando sobre el contenido) porque el editor de
  // mundo (/myself/garlia) no tiene su propio header superior. Contextual:
  //   - sin sección activa → no se muestra (ya estás en el menú de 12).
  //   - con sección activa, sin entidad seleccionada → vuelve al menú.
  //   - con entidad seleccionada (lista oculta) → vuelve a la lista.
  const mundoSection = useMundoNavigation((s) => s.section);
  const mundoSelectedId = useMundoNavigation((s) => s.selectedId);
  const mundoGoToMenu = useMundoNavigation((s) => s.goToMenu);
  const mundoClearSelection = useMundoNavigation((s) => s.clearSelection);
  const mundoSelectSection = useMundoNavigation((s) => s.selectSection);
  const showMundoBack = isGarliaeditor && mundoSection !== null;
  // Ahora solo se usa para volver de una entidad seleccionada a la lista —
  // volver de una sección al menú de 12 lo cubre "Volver al navbar normal"
  // (ver render del botón más abajo, que además filtra por mundoSelectedId).
  const mundoBackAction = mundoClearSelection;
  const mundoBackLabel = "Volver a la lista";

  // ── Link definitions ─────────────────────────────────────────────────────────

  const personalLinks: NavLinkDef[] = [
    {
      href: "/personal/sobre-mi",
      label: "Sobre Mí",
      icon: Star,
      active: currentPath?.startsWith("/personal/sobre-mi") ?? false,
      fillActive: true,
    },
    ...(user
      ? [
          {
            href: "/personal/mensajes",
            label: "Mensajes",
            icon: MessageCircle,
            active: currentPath?.startsWith("/personal/mensajes") ?? false,
            fillActive: false,
          },
        ]
      : []),
  ];

  // Aventura y Runas solo se muestran con sesión iniciada. En desktop van
  // como dos ítems normales y seguidos en el sidebar (Runas debajo de
  // Aventura, sin flyout). En mobile, Aventura se agrupa con Runas bajo un
  // solo botón con panel flotante (subLinks) — ver mobileGarliaLinks más
  // abajo, que reusa esta misma definición y solo cambia cómo se agrupan.
  const isRunas = currentPath?.startsWith("/garlia/runas") ?? false;
  const isAventura = currentPath?.startsWith("/garlia/aventura") ?? false;

  const garliaLinks: NavLinkDef[] = [
    {
      href: user ? "/garlia/personal" : "/auth/login",
      label: "Cuenta",
      icon: CircleUser,
      active: personalIsActive,
    },
    ...(user
      ? [
          {
            href: "/garlia/mapa",
            label: "Mapa",
            icon: Compass,
            active: currentPath?.startsWith("/garlia/mapa") ?? false,
          },
        ]
      : []),
    {
      href: "/garlia/libros",
      label: "Libros",
      icon: BookText,
      active: currentPath?.startsWith("/garlia/libros") ?? false,
    },
  ];

  // Versión mobile: mismos links que garliaLinks (Aventura y Runas ocultos
  // acá también — ver arriba).
  const mobileGarliaLinks: NavLinkDef[] = [
    {
      href: user ? "/garlia/personal" : "/auth/login",
      label: "Cuenta",
      icon: CircleUser,
      active: personalIsActive,
    },
    ...(user
      ? [
          {
            href: "/garlia/mapa",
            label: "Mapa",
            icon: Compass,
            active: currentPath?.startsWith("/garlia/mapa") ?? false,
          },
        ]
      : []),
    {
      href: "/garlia/libros",
      label: "Libros",
      icon: BookText,
      active: currentPath?.startsWith("/garlia/libros") ?? false,
    },
  ];

  // aventuraSubLinks queda sin uso ahora que "Aventura" no aparece en
  // garliaLinks/mobileGarliaLinks (ítem con subLinks solo se activaba
  // para href === "/garlia/aventura") — se mantiene la definición por si
  // se vuelve a mostrar más adelante, pero no se referencia en el render.
  const aventuraSubLinks: NavLinkDef[] = [
    {
      href: "/garlia/aventura",
      label: "Aventura",
      icon: BookOpen,
      active: isAventura,
    },
    {
      href: "/garlia/runas",
      label: "Runas",
      icon: ScrollText,
      active: isRunas,
    },
  ];

  const mainLinks: NavLinkDef[] = [
    {
      href: "/personal",
      label: "Personal",
      icon: Star,
      active: isPersonal,
      fillActive: true,
    },
    {
      href: "/garlia",
      label: "Jardín",
      icon: Flower2,
      active: isGarlia,
      fillActive: false,
    },
  ];

  const franiLinks: NavLinkDef[] = [
    {
      href: "/myself/garlia",
      label: "Arte",
      icon: Cat,
      active: isGarliaeditor,
    },
  ];

  // ── Submenú admin (desktop) ──────────────────────────────────────────────
  // Reemplaza a <MundoTabs /> (que vivía arriba del editor): toda la
  // navegación entre secciones de /myself/garlia pasa a vivir acá.
  // "Criaturas" ya NO es una sección propia del submenú: la vista de
  // Personajes ahora tiene un dropdown para agrupar por Reino, por
  // Criatura o por Items (ver EntidadesPage/AgrupacionPersonajesDropdown),
  // así que "criaturas" solo sigue existiendo como SectionKey transitoria
  // cuando se abre el editor puntual de una criatura desde ese dropdown —
  // por eso sigue contando como "Entidades" acá (no tiene entrada de menú
  // propia). "Items" tampoco tiene entrada propia por el mismo motivo:
  // pasó a ser la 3ra opción de ese mismo dropdown en vez de una sección
  // propia de la navbar.
  // "Organización" (Grupos/Notas) ya NO vive acá — se sacó del submenú y
  // ahora es un botón propio en el Home del editor de mundo (ver
  // MundoHomeContent), en vez de una sección más de navegación global.
  const ENTIDADES_SECTIONS = new Set<SectionKey>([
    "personajes",
    "criaturas",
    "items",
    "reinos",
    "ciudades",
  ]);

  // "Magia" agrupa Runas + Tabla (elementos) — antes vivía dentro de
  // "Entidades", pero al tener su propio editor (FormularioMagico) tiene
  // más sentido como sección propia. "elementos" faltaba acá (bug
  // preexistente): el botón del navbar no se marcaba activo al entrar a
  // "Tabla", aunque la sección sí funcionara. "Física" NO es un SectionKey
  // de ruta — vive como 4ta pill del toggle interno de RunasPage (ver
  // SeccionMagia en RunasPage.tsx), así que no corresponde acá.
  const MAGIA_SECTIONS = new Set<SectionKey>(["runas", "elementos"]);

  type AdminSubmenuItem = {
    key: string;
    label: string;
    icon: React.ElementType;
    active: boolean;
    onSelect: () => void;
  };
  type AdminSubmenuEntry = AdminSubmenuItem | { key: string; divider: true };

  const adminSubmenuItems: AdminSubmenuEntry[] = [
    {
      key: "inicio",
      label: "Inicio",
      icon: Home,
      active: isGarliaeditor && mundoSection === null,
      onSelect: () => mundoGoToMenu(),
    },
    {
      key: "mapa",
      label: "Mapa",
      icon: Mountain,
      active: isGarliaeditor && mundoSection === "mapa",
      onSelect: () => mundoSelectSection("mapa"),
    },
    {
      key: "linea-tiempo",
      label: "Línea de tiempo",
      icon: Clock,
      active: isGarliaeditor && mundoSection === "linea-tiempo",
      onSelect: () => mundoSelectSection("linea-tiempo"),
    },
    { key: "div-1", divider: true },
    {
      key: "entidades",
      label: "Entidades",
      icon: Users,
      active:
        isGarliaeditor &&
        mundoSection !== null &&
        ENTIDADES_SECTIONS.has(mundoSection),
      onSelect: () => mundoSelectSection("personajes"),
    },
    {
      key: "magia",
      label: "Magia",
      icon: Wand2,
      active:
        isGarliaeditor &&
        mundoSection !== null &&
        MAGIA_SECTIONS.has(mundoSection),
      onSelect: () => mundoSelectSection("runas"),
    },
    {
      key: "auditoria",
      label: "Auditoría",
      icon: ClipboardCheck,
      active: isGarliaeditor && mundoSection === "auditoria",
      onSelect: () => mundoSelectSection("auditoria"),
    },
    { key: "div-2", divider: true },
    {
      key: "capitulos",
      label: "Capítulos",
      icon: ScrollText,
      active: isGarliaeditor && mundoSection === "capitulos",
      onSelect: () => mundoSelectSection("capitulos"),
    },
    {
      key: "letras",
      label: "Canciones",
      icon: Music,
      active: isGarliaeditor && mundoSection === "letras",
      onSelect: () => mundoSelectSection("letras"),
    },
    { key: "div-3", divider: true },
    {
      key: "aventura",
      label: "Aventura",
      icon: Compass,
      active: isGarliaeditor && mundoSection === "aventura",
      onSelect: () => mundoSelectSection("aventura"),
    },
  ];

  // ── Submenú Escritorio (desktop) ─────────────────────────────────────────
  // Mismo patrón que adminSubmenuItems: click en "Escritorio" abre el
  // submenú acá en vez de navegar; cada item cambia la sección activa vía
  // useEscritorioNavigation, sin tocar la URL.
  type EscritorioSubmenuItem = {
    key: string;
    label: string;
    icon: React.ElementType;
    active: boolean;
    onSelect: () => void;
  };

  const escritorioSubmenuItems: EscritorioSubmenuItem[] = [
    {
      key: "inicio",
      label: "Inicio",
      icon: Home,
      active: isEscritorio && escritorioSection === "inicio",
      onSelect: () => selectEscritorioSection("inicio"),
    },
    {
      key: "libros",
      label: "Libros",
      icon: BookText,
      active: isEscritorio && escritorioSection === "libros",
      onSelect: () => selectEscritorioSection("libros"),
    },
    {
      key: "cocina",
      label: "Cocina",
      icon: Utensils,
      active: isEscritorio && escritorioSection === "cocina",
      onSelect: () => selectEscritorioSection("cocina"),
    },
    {
      key: "ingredientes",
      label: "Ingredientes",
      icon: Wheat,
      active: isEscritorio && escritorioSection === "ingredientes",
      onSelect: () => selectEscritorioSection("ingredientes"),
    },
    {
      key: "ejercicio",
      label: "Ejercicio",
      icon: Dumbbell,
      active: isEscritorio && escritorioSection === "ejercicio",
      onSelect: () => selectEscritorioSection("ejercicio"),
    },
    {
      key: "ropa",
      label: "Ropa",
      icon: Shirt,
      active: isEscritorio && escritorioSection === "ropa",
      onSelect: () => selectEscritorioSection("ropa"),
    },
  ];

  // ── Atajos globales "g + g/d + letra" (estilo Gmail/Linear) ──────────────
  // Funcionan desde CUALQUIER página (no solo dentro de /myself/*): si no
  // estamos en la ruta correspondiente, primero navegamos y de paso dejamos
  // seteada la sección en el store — así al llegar ya se ve la sección
  // correcta en vez de la última que quedó guardada. Si ya estamos en la
  // ruta, solo cambia de sección sin recargar nada.
  // "gg_" = Garlia (/myself/garlia), "gd_" = Desktop/Escritorio (/myself/escritorio).
  useGotoHotkeys({
    // ── Garlia ──────────────────────────────────────────────────────────
    ggh: () => {
      if (!isGarliaeditor) router.push("/myself/garlia");
      mundoGoToMenu();
    },
    ggl: () => {
      if (!isGarliaeditor) router.push("/myself/garlia");
      mundoSelectSection("capitulos");
    },
    gga: () => {
      if (!isGarliaeditor) router.push("/myself/garlia");
      mundoSelectSection("aventura");
    },
    gge: () => {
      if (!isGarliaeditor) router.push("/myself/garlia");
      mundoSelectSection("personajes"); // Entidades
    },
    ggm: () => {
      if (!isGarliaeditor) router.push("/myself/garlia");
      mundoSelectSection("mapa");
    },
    ggc: () => {
      if (!isGarliaeditor) router.push("/myself/garlia");
      mundoSelectSection("letras"); // Canciones
    },
    ggt: () => {
      if (!isGarliaeditor) router.push("/myself/garlia");
      mundoSelectSection("linea-tiempo");
    },
    // ── Escritorio ──────────────────────────────────────────────────────
    gdh: () => {
      if (!isEscritorio) router.push("/myself/escritorio");
      selectEscritorioSection("inicio");
    },
    gdl: () => {
      if (!isEscritorio) router.push("/myself/escritorio");
      selectEscritorioSection("libros");
    },
    gdc: () => {
      if (!isEscritorio) router.push("/myself/escritorio");
      selectEscritorioSection("cocina");
    },
    gdi: () => {
      if (!isEscritorio) router.push("/myself/escritorio");
      selectEscritorioSection("ingredientes");
    },
    gde: () => {
      if (!isEscritorio) router.push("/myself/escritorio");
      selectEscritorioSection("ejercicio");
    },
    gdr: () => {
      if (!isEscritorio) router.push("/myself/escritorio");
      selectEscritorioSection("ropa");
    },
  });

  // ── Shared mobile toggle handler ─────────────────────────────────────────────

  const mobileToggle = (href: string) =>
    setMobileOpenMenu(mobileOpenMenu === href ? null : href);

  return (
    <>
      {/* ── SIDEBAR DESKTOP ──────────────────────────────────────── */}
      <aside
        className="hidden md:flex fixed left-0 top-0 h-full z-[100] flex-col"
        style={{
          width: "52px",
          background: "color-mix(in srgb, var(--bg-main) 92%, transparent)",
          borderRight:
            "var(--border-width) solid color-mix(in srgb, var(--primary) 12%, transparent)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {!adminSubmenuOpen && !escritorioSubmenuOpen && (
          <div className="relative shrink-0 mx-auto">
            <button
              className="flex items-center justify-center transition-all"
              style={{
                width: "36px",
                height: "52px",
                color: "var(--primary)",
                background: themeMenuOpen
                  ? "color-mix(in srgb, var(--primary) 10%, transparent)"
                  : "transparent",
              }}
              title="Cambiar tema"
              onClick={() => setThemeMenuOpen(!themeMenuOpen)}
            >
              <Flower2 size={18} />
            </button>

            <AnimatePresence>
              {themeMenuOpen && (
                <>
                <MotionDiv
                  animate={{ opacity: 1 }}
                  className="fixed inset-0 z-[1000]"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  onClick={closeAll}
                />
                <MotionDiv
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  className="absolute left-full top-0 ml-2 w-56 z-[1001] overflow-hidden"
                  exit={{ opacity: 0, x: -8, scale: 0.97 }}
                  initial={{ opacity: 0, x: -8, scale: 0.97 }}
                  style={submenuSurface}
                  transition={{ duration: 0.15 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="flex items-center gap-2.5 w-full px-4 py-3 transition-all"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 60%, transparent)",
                      borderBottom:
                        "var(--border-width) solid color-mix(in srgb, var(--primary) 8%, transparent)",
                    }}
                    onClick={toggleDark}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "color-mix(in srgb, var(--primary) 5%, transparent)";
                      (e.currentTarget as HTMLElement).style.color =
                        "var(--primary)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "transparent";
                      (e.currentTarget as HTMLElement).style.color =
                        "color-mix(in srgb, var(--primary) 60%, transparent)";
                    }}
                  >
                    {isDark ? <Sun size={13} /> : <Moon size={13} />}
                    <span className="text-micro font-black uppercase tracking-widest">
                      {isDark ? "Modo claro" : "Modo oscuro"}
                    </span>
                  </button>
                  {isAdmin && (
                    <Link
                      className="flex items-center gap-2.5 w-full px-4 py-3 transition-all"
                      href="/myself/actualizaciones"
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 60%, transparent)",
                        borderBottom:
                          "var(--border-width) solid color-mix(in srgb, var(--primary) 8%, transparent)",
                      }}
                      onClick={closeAll}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background =
                          "color-mix(in srgb, var(--primary) 5%, transparent)";
                        (e.currentTarget as HTMLElement).style.color =
                          "var(--primary)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background =
                          "transparent";
                        (e.currentTarget as HTMLElement).style.color =
                          "color-mix(in srgb, var(--primary) 60%, transparent)";
                      }}
                    >
                      <Upload size={13} />
                      <span className="text-micro font-black uppercase tracking-widest">
                        Actualizar APK
                      </span>
                    </Link>
                  )}
                  <ThemeSelector />
                </MotionDiv>
              </>
            )}
            </AnimatePresence>
          </div>
        )}

        {!adminSubmenuOpen && !escritorioSubmenuOpen && (
          <NavDivider margin="0 12px" />
        )}

        <nav className="flex flex-col gap-1 px-2 pt-3 flex-1">
          {isAdmin && adminSubmenuOpen ? (
            <>
              <SideNavItem
                active={false}
                href="#"
                icon={ArrowLeft}
                label="Volver al navbar normal"
                onClose={(e) => {
                  e?.preventDefault();
                  setAdminSubmenuOpen(false);
                }}
              />
              <NavDivider />
              {adminSubmenuItems.map((entry) =>
                "divider" in entry ? (
                  <NavDivider key={entry.key} />
                ) : (
                  <SideNavItem
                    key={entry.key}
                    active={entry.active}
                    href="/myself/garlia"
                    icon={entry.icon}
                    label={entry.label}
                    onClose={() => {
                      entry.onSelect();
                      closeAll();
                    }}
                  />
                ),
              )}
            </>
          ) : isAdmin && escritorioSubmenuOpen ? (
            <>
              <SideNavItem
                active={false}
                href="#"
                icon={ArrowLeft}
                label="Volver al navbar normal"
                onClose={(e) => {
                  e?.preventDefault();
                  setEscritorioSubmenuOpen(false);
                }}
              />
              <NavDivider />
              {escritorioSubmenuItems.map(
                ({ key, label, icon, active, onSelect }) => (
                  <SideNavItem
                    key={key}
                    active={active}
                    href="/myself/escritorio"
                    icon={icon}
                    label={label}
                    onClose={() => {
                      onSelect();
                      closeAll();
                    }}
                  />
                ),
              )}
            </>
          ) : (
            <>
              {personalLinks.map(({ href, label, icon, active, fillActive }) => (
                <SideNavItem
                  key={href}
                  active={active}
                  fillActive={fillActive}
                  href={href}
                  icon={icon}
                  label={label}
                  onClose={closeAll}
                />
              ))}
              <NavDivider />
              {garliaLinks.map(({ href, label, icon, active, fillActive }) => (
                <SideNavItem
                  key={href}
                  active={active}
                  fillActive={fillActive}
                  href={href}
                  icon={icon}
                  label={label}
                  onClose={closeAll}
                />
              ))}
              {isAdmin && (
                <>
                  <NavDivider />
                  <SideNavItem
                    active={isEscritorio}
                    href="/myself/escritorio"
                    icon={PenTool}
                    label="Escritorio"
                    onClose={(e) => {
                      e?.preventDefault();
                      setEscritorioSubmenuOpen(true);
                    }}
                  />
                  {franiLinks.map(({ href, label, icon, active }) => (
                    <SideNavItem
                      key={href}
                      active={active}
                      href={href}
                      icon={icon}
                      label={label}
                      onClose={(e) => {
                        e?.preventDefault();
                        setAdminSubmenuOpen(true);
                      }}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </nav>
      </aside>

      {/* ── MOBILE NAVBAR ────────────────────────────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 w-full z-[1000]">
        <AnimatePresence>
          {themeMenuOpen && (
            <>
              <MotionDiv
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-[90]"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                onClick={closeAll}
              />
              <MotionDiv
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute bottom-full left-4 mb-2 w-56 overflow-hidden z-[2000]"
                exit={{ opacity: 0, y: 12, scale: 0.97 }}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                style={submenuSurface}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                onClick={(e) => e.stopPropagation()}
              >
                <ThemeSelector />
              </MotionDiv>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {mobileOpenMenu && (
            <MotionDiv
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[90]"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={closeAll}
            />
          )}
        </AnimatePresence>

        <div
          className="flex items-center justify-between w-full px-4 relative z-[100]"
          style={{
            height: "56px",
            background: "color-mix(in srgb, var(--bg-main) 90%, transparent)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderTop:
              "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
          }}
        >
          {/* Theme toggle */}
          <div className="flex items-center gap-1 z-[101]">
            {/* Botón de "volver" del editor de Mundo: ahora solo se muestra
                para volver de una entidad seleccionada a la lista (flecha).
                Volver de una sección al menú de 12 secciones (antes la X)
                ya lo cubre "Volver al navbar normal" del bloque de arriba,
                así que mostrar los dos al mismo tiempo era redundante. */}
            {showMundoBack && mundoSelectedId && (
              <button
                type="button"
                onClick={mundoBackAction}
                className="flex items-center justify-center transition-all"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "var(--radius-btn)",
                  background: "transparent",
                  color: "color-mix(in srgb, var(--primary) 40%, transparent)",
                }}
                title={mundoBackLabel}
                aria-label={mundoBackLabel}
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <button
              className="flex items-center justify-center transition-all"
              style={{
                width: 34,
                height: 34,
                borderRadius: "var(--radius-btn)",
                background: themeMenuOpen
                  ? "color-mix(in srgb, var(--primary) 10%, transparent)"
                  : "transparent",
                color: themeMenuOpen
                  ? "var(--primary)"
                  : "color-mix(in srgb, var(--primary) 40%, transparent)",
              }}
              onClick={() => {
                setThemeMenuOpen(!themeMenuOpen);
                setMobileOpenMenu(null);
              }}
            >
              <Palette size={16} />
            </button>
          </div>

          {/* Center nav items */}
          <div
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 z-[101]"
            style={{
              background: "color-mix(in srgb, var(--primary) 5%, transparent)",
              borderRadius: "var(--radius-card)",
              border:
                "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
            }}
          >
            {isAdmin && adminSubmenuOpen ? (
              // Mismo patrón que el sidebar desktop: mientras el editor de
              // Garlia/Mundo está activo, la fila reemplaza sus botones
              // normales por "volver" + las secciones del editor, en vez de
              // abrir un flotante encima.
              <>
                <MobileFlatButton
                  active={false}
                  icon={ArrowLeft}
                  label="Volver al navbar normal"
                  onClick={() => {
                    setAdminSubmenuOpen(false);
                    closeAll();
                  }}
                />
                <NavVerticalDivider />
                {adminSubmenuItems.map((entry) =>
                  "divider" in entry ? (
                    <NavVerticalDivider key={entry.key} />
                  ) : (
                    <MobileFlatButton
                      key={entry.key}
                      active={entry.active}
                      icon={entry.icon}
                      label={entry.label}
                      onClick={() => {
                        entry.onSelect();
                        closeAll();
                      }}
                    />
                  ),
                )}
              </>
            ) : isAdmin && escritorioSubmenuOpen ? (
              // Mismo patrón para Escritorio.
              <>
                <MobileFlatButton
                  active={false}
                  icon={ArrowLeft}
                  label="Volver al navbar normal"
                  onClick={() => {
                    setEscritorioSubmenuOpen(false);
                    closeAll();
                  }}
                />
                <NavVerticalDivider />
                {escritorioSubmenuItems.map(
                  ({ key, label, icon, active, onSelect }) => (
                    <MobileFlatButton
                      key={key}
                      active={active}
                      icon={icon}
                      label={label}
                      onClick={() => {
                        onSelect();
                        closeAll();
                      }}
                    />
                  ),
                )}
              </>
            ) : isAdmin ? (
              <>
                {mainLinks.map(({ href, label, icon, active, fillActive }) => (
                  <MobileNavItem
                    key={href}
                    active={active}
                    fillActive={fillActive}
                    href={href}
                    icon={icon}
                    isOpen={mobileOpenMenu === href}
                    label={label}
                    onClose={closeAll}
                    onToggle={() => mobileToggle(href)}
                  />
                ))}
                <NavVerticalDivider />
                <MobileNavItem
                  active={isEscritorio}
                  fillActive
                  href="/myself/escritorio"
                  icon={PenTool}
                  isOpen={false}
                  label="Escritorio"
                  onClose={() => {
                    setEscritorioSubmenuOpen(true);
                  }}
                  onToggle={() => setEscritorioSubmenuOpen(true)}
                />
                {franiLinks.map(({ href, label, icon, active }) => (
                  <MobileNavItem
                    key={href}
                    active={active}
                    href={href}
                    icon={icon}
                    isOpen={false}
                    label={label}
                    onClose={() => {
                      setAdminSubmenuOpen(true);
                    }}
                    onToggle={() => setAdminSubmenuOpen(true)}
                  />
                ))}
              </>
            ) : (
              <>
                {personalLinks.map(
                  ({ href, label, icon, active, fillActive }) => (
                    <MobileNavItem
                      key={href}
                      active={active}
                      fillActive={fillActive}
                      href={href}
                      icon={icon}
                      isOpen={mobileOpenMenu === href}
                      label={label}
                      onClose={closeAll}
                      onToggle={() => mobileToggle(href)}
                    />
                  ),
                )}
                <NavVerticalDivider />
                {mobileGarliaLinks.map(
                  ({ href, label, icon, active, fillActive }) => (
                    <MobileNavItem
                      key={href}
                      active={active}
                      fillActive={fillActive}
                      href={href}
                      icon={icon}
                      isOpen={mobileOpenMenu === href}
                      label={label}
                      // "Aventura" agrupa Runas debajo en un panel flotante
                      // (mismo patrón que cualquier otro ítem con subLinks);
                      // el resto navega directo como siempre.
                      subLinks={href === "/garlia/aventura" ? aventuraSubLinks : undefined}
                      onClose={closeAll}
                      onToggle={() => mobileToggle(href)}
                    />
                  ),
                )}
              </>
            )}
          </div>

          {/* Search + panel lateral del editor activo (si expone uno) */}
          <div className="flex items-center gap-1 z-[101]">
            {asideAvailable && (
              <button
                className="flex items-center justify-center transition-all"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "var(--radius-btn)",
                  background: asideOpen
                    ? "color-mix(in srgb, var(--primary) 10%, transparent)"
                    : "transparent",
                  color: asideOpen
                    ? "var(--primary)"
                    : "color-mix(in srgb, var(--primary) 40%, transparent)",
                }}
                title="Entidades"
                aria-label="Entidades"
                onClick={() => {
                  toggleAside();
                  closeAll();
                }}
              >
                <SlidersHorizontal size={16} />
              </button>
            )}
            <button
              className="flex items-center justify-center transition-all"
              style={{
                width: 34,
                height: 34,
                borderRadius: "var(--radius-btn)",
                color: "color-mix(in srgb, var(--primary) 40%, transparent)",
              }}
              onClick={() => {
                openPalette(true);
                closeAll();
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "color-mix(in srgb, var(--primary) 10%, transparent)";
                (e.currentTarget as HTMLElement).style.color = "var(--primary)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
                (e.currentTarget as HTMLElement).style.color =
                  "color-mix(in srgb, var(--primary) 40%, transparent)";
              }}
            >
              <Search size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
