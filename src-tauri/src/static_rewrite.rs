// Replica, dentro de la app de Tauri, los `rewrites` de vercel.json.
//
// Contexto (POST-REDISEÑO del sistema de carga de capítulos):
// el sitio usa `output: "export"` (HTML estático). Antes, las rutas
// dinámicas tipo `/garlia/libros/[id]` solo se prerrenderizaban como
// `.../placeholder`, y vercel.json reescribía la URL hacia ese archivo
// dejando la URL del navegador intacta (el componente cliente leía el
// slug real desde `window.location`).
//
// El rediseño reemplazó ese esquema por rutas FIJAS que reciben el
// slug/orden como query param, construidas por
// `domains/garlia/*/utils/rutas.ts` vía `IS_TAURI_BUILD`:
//   /garlia/libros/detalle?slug=...
//   /garlia/libros/leer?slug=...&orden=...
//   /garlia/canciones/detalle?slug=...
//   /garlia/personal/detalle?username=...
//   /personal/mensajes/detalle?id=...
//
// Estas rutas fijas SIEMPRE existen tal cual en el build exportado (no son
// segmentos dinámicos), así que Tauri ya no necesita reescribir nada para
// ellas. Las carpetas `[slug]`, `[username]`, `[orden]`, etc. siguen en el
// árbol de Next.js pero solo para SSR web: `generateStaticParams` devuelve
// `[]` en build de Tauri, por lo que esos archivos ni se generan.
//
// Esta función queda como punto de extensión por si en el futuro se
// reintroduce alguna ruta dinámica real en el build de Tauri, pero hoy no
// debe reescribir ninguno de los paths de arriba: hacerlo (como pasaba
// antes, apuntando a un esquema `.../placeholder/...` que ya no existe)
// produce 404 y por eso los capítulos no cargaban pese a que
// `useCargadorContenido` nunca llega a ejecutarse.
pub fn rewrite_path(path: &str) -> String {
    // Sin reglas activas: el rediseño eliminó los segmentos dinámicos que
    // esta función traducía. Se deja `path` intacto siempre.
    let _ = path;
    path.to_string()
}

#[cfg(test)]
mod tests {
    use super::rewrite_path;

    #[test]
    fn no_reescribe_detalle_libro() {
        assert_eq!(
            rewrite_path("/garlia/libros/detalle?slug=mi-novela"),
            "/garlia/libros/detalle?slug=mi-novela"
        );
    }

    #[test]
    fn no_reescribe_leer_capitulo() {
        assert_eq!(
            rewrite_path("/garlia/libros/leer?slug=mi-novela&orden=3"),
            "/garlia/libros/leer?slug=mi-novela&orden=3"
        );
    }

    #[test]
    fn no_reescribe_detalle_cancion() {
        assert_eq!(
            rewrite_path("/garlia/canciones/detalle?slug=mi-cancion"),
            "/garlia/canciones/detalle?slug=mi-cancion"
        );
    }

    #[test]
    fn no_reescribe_detalle_personal() {
        assert_eq!(
            rewrite_path("/garlia/personal/detalle?username=algun_user"),
            "/garlia/personal/detalle?username=algun_user"
        );
    }

    #[test]
    fn no_reescribe_detalle_mensajes() {
        assert_eq!(
            rewrite_path("/personal/mensajes/detalle?id=123"),
            "/personal/mensajes/detalle?id=123"
        );
    }

    #[test]
    fn no_toca_rutas_estaticas_normales() {
        assert_eq!(rewrite_path("/garlia/libros"), "/garlia/libros");
        assert_eq!(rewrite_path("/_next/static/chunk.js"), "/_next/static/chunk.js");
        assert_eq!(rewrite_path("/"), "/");
    }

    #[test]
    fn no_reescribe_segmentos_dinamicos_legacy_si_llegaran() {
        // Estos paths ya no los genera `rutas.ts`, pero si algo viejo
        // (caché, deep link guardado, etc.) todavía los pide, no deben
        // traducirse a un esquema `placeholder` que ya no existe en el
        // build: mejor un 404 explícito que una reescritura rota.
        assert_eq!(
            rewrite_path("/garlia/libros/mi-novela/leer/cap-3"),
            "/garlia/libros/mi-novela/leer/cap-3"
        );
        assert_eq!(
            rewrite_path("/garlia/libros/mi-novela"),
            "/garlia/libros/mi-novela"
        );
    }
}
