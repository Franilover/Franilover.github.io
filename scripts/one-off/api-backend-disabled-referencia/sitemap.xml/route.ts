import { NextResponse } from "next/server";

import { supabase } from "@/lib/api/client/supabase";
import { toSlug } from "@/lib/utils/slugify";

export const dynamic = "force-dynamic";

// Definición explícita de interfaces para evitar inferencias incorrectas ('never') de Supabase
interface LibroRow {
  titulo: string;
  created_at: string | null;
}

interface CapituloRow {
  orden: number;
  fecha_publicacion: string | null;
  libros: { titulo: string } | { titulo: string }[] | null;
}

interface PerfilRow {
  username: string;
}

export async function GET() {
  const baseUrl = "https://franilover.vercel.app";

  // 1. Definición de rutas estáticas principales del ecosistema con la ruta corregida
  const staticPages = [
    {
      loc: `${baseUrl}`,
      priority: "1.0",
      changefreq: "daily",
      lastmod: new Date().toISOString(),
    },
    {
      loc: `${baseUrl}/garlia`,
      priority: "0.8",
      changefreq: "weekly",
      lastmod: new Date().toISOString(),
    },
    {
      loc: `${baseUrl}/garlia/personal`,
      priority: "0.8",
      changefreq: "weekly",
      lastmod: new Date().toISOString(),
    },
  ];

  try {
    // 2. Consultar libros desde Supabase con tipado explícito
    const { data: librosData } = await supabase
      .from("libros")
      .select("titulo, created_at");

    const libros = (librosData as unknown as LibroRow[]) || [];

    const librosPages = libros.map((libro) => {
      const slug = toSlug(libro.titulo);
      return {
        loc: `${baseUrl}/garlia/libros/${slug}`,
        priority: "0.8",
        changefreq: "weekly",
        lastmod: libro.created_at || new Date().toISOString(),
      };
    });

    // 3. Consultar capítulos vinculados con sus respectivos libros con tipado explícito
    const { data: capitulosData } = await supabase
      .from("capitulos")
      .select("orden, fecha_publicacion, libros ( titulo )");

    const capitulos = (capitulosData as unknown as CapituloRow[]) || [];

    // Filtramos y mapeamos descartando capítulos que carecen de una relación de libro real
    const capitulosPages = capitulos
      .map((cap) => {
        let libroTitulo = "";
        
        if (cap.libros) {
          if (Array.isArray(cap.libros)) {
            libroTitulo = cap.libros[0]?.titulo || "";
          } else {
            libroTitulo = cap.libros.titulo || "";
          }
        }

        // Si no se encuentra un título válido, retornamos null para filtrarlo posteriormente
        if (!libroTitulo) {
          return null;
        }

        const libroSlug = toSlug(libroTitulo);
        return {
          loc: `${baseUrl}/garlia/libros/${libroSlug}/leer/${cap.orden}`,
          priority: "0.7",
          changefreq: "daily",
          lastmod: cap.fecha_publicacion || new Date().toISOString(),
        };
      })
      .filter((page): page is Exclude<typeof page, null> => page !== null);

    // 4. Consultar todos los perfiles públicos para indexar sus nombres de usuario dinámicamente bajo /garlia/personal
    const { data: perfilesData } = await supabase
      .from("perfiles")
      .select("username");

    const perfiles = (perfilesData as unknown as PerfilRow[]) || [];

    const perfilesPages = perfiles.map((perfil) => {
      return {
        loc: `${baseUrl}/garlia/personal/${perfil.username}`,
        priority: "0.6",
        changefreq: "weekly",
        lastmod: new Date().toISOString(),
      };
    });

    // Combinar absolutamente todas las colecciones de rutas procesadas y válidas
    const allPages = [
      ...staticPages,
      ...librosPages,
      ...capitulosPages,
      ...perfilesPages,
    ];

    // Construcción del documento XML estructurado
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map((page) => {
    return `  <url>
    <loc>${page.loc}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  })
  .join("\n")}
</urlset>`;

    return new NextResponse(sitemapXml, {
      headers: {
        "Content-Type": "application/xml",
      },
    });

  } catch (error) {
    console.error("[SITEMAP_ERROR] Error generando el sitemap dinámico:", error);
    
    // Fallback de emergencia con rutas estáticas en caso de fallo crítico de base de datos
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages
  .map((page) => {
    return `  <url>
    <loc>${page.loc}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  })
  .join("\n")}
</urlset>`;

    return new NextResponse(fallbackXml, {
      headers: {
        "Content-Type": "application/xml",
      },
    });
  }
}