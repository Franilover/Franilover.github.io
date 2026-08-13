"use client";
/**
 * MarkdownPastePlugin.tsx
 * ─────────────────────────
 * Detecta cuando el usuario pega texto con "forma" de markdown (headings,
 * listas, negrita/cursiva, citas, código, tablas, links, fórmulas $/$$)
 * y lo convierte en nodos reales de Lexical en vez de pegarlo como texto
 * plano.
 *
 * Por qué un plugin aparte y no reusar rawTextToLexicalTree() tal cual:
 * esa función hace $getRoot().clear() — está pensada para cargar el
 * documento completo (InitialContentPlugin), no para insertar en medio
 * de uno existente. Acá necesitamos insertar EN el punto del cursor sin
 * tocar el resto del documento, así que:
 *
 *   1) Interceptamos PASTE_COMMAND con prioridad alta (antes que el
 *      handler default de RichTextPlugin, que pegaría el texto plano tal
 *      cual carácter por carácter).
 *   2) Heurística looksLikeMarkdown(): si el texto pegado no tiene ninguna
 *      marca de markdown reconocible, no interceptamos — dejamos pasar
 *      (return false) para que el paste plano normal de Lexical ocurra.
 *   3) Si parece markdown: usamos un LexicalEditor headless *temporal*
 *      (createEditor con los mismos nodes que el editor real) para
 *      correr $convertFromMarkdownString ahí — así el root.clear() que
 *      hace esa función limpia el documento temporal, no el real. Leemos
 *      los nodos resultantes, los clonamos hacia el editor real y los
 *      insertamos en la posición del cursor con selection.insertNodes().
 *      Este es el patrón que la propia documentación de Lexical
 *      recomienda para "convertir markdown sin perder el documento
 *      actual" (evita el bug de pasar nodo destino, facebook/lexical#7663
 *      mencionado en richTextSerializer.ts).
 *
 * No reintenta la sintaxis extendida del proyecto (snippets [[drop|...]],
 * tablas con parseTableBlock, etc. — ver richTextSerializer.ts): eso es
 * deliberado. El texto que alguien pega desde afuera (un editor externo,
 * ChatGPT, un README) es markdown estándar; si además contuviera nuestra
 * sintaxis propia de snippets, $convertFromMarkdownString simplemente la
 * deja como texto plano (no rompe nada), y rawTextToLexicalTree sigue
 * siendo el único punto de entrada para *cargar* documentos con esa
 * sintaxis completa.
 *
 * FÓRMULAS ($ / $$): "$formula$" inline ya está cubierto por
 * MATH_INLINE_TRANSFORMER dentro de RICH_TRANSFORMERS (ver
 * VariantHeadingNode.tsx), así que $convertFromMarkdownString lo resuelve
 * solo. "$$formula$$" en bloque es multilinea — igual que las tablas en
 * rawTextToLexicalTree, se extrae ANTES de pasarle el texto al editor
 * headless (si no, $convertFromMarkdownString vería el "$$" como texto
 * plano de un párrafo cualquiera) y se reinserta como MathNode real
 * después de la conversión.
 */
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $convertFromMarkdownString } from "@lexical/markdown";
import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListNode, ListItemNode } from "@lexical/list";
import { QuoteNode } from "@lexical/rich-text";
import {
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $parseSerializedNode,
  createEditor,
  COMMAND_PRIORITY_HIGH,
  PASTE_COMMAND,
} from "lexical";
import { useEffect } from "react";
import { RICH_TRANSFORMERS, VariantHeadingNode } from "../nodes/VariantHeadingNode";
import { $createMathNode, MATH_BLOCK_RE, MathNode } from "../nodes/MathNode";
import { TABLE_NODES } from "./TablePlugin";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";

// Nodos mínimos necesarios para que $convertFromMarkdownString reconozca
// heading, cita, lista, código, link, tabla, regla horizontal y fórmulas —
// el subconjunto de RICH_EDITOR_NODES relevante a markdown estándar. No
// incluye los nodos custom del proyecto (DropNode, ChoiceNode, etc.)
// porque texto pegado desde afuera nunca va a producir esa sintaxis propia.
//
// CRÍTICO: este set tiene que ser un superconjunto de TODO tipo de nodo
// que RICH_TRANSFORMERS pueda intentar crear, no solo "lo que se ve
// obviamente relacionado a markdown". HorizontalRuleNode es la prueba: es
// markdown estándar ("---"), el propio RICH_TRANSFORMERS lo cubre (hereda
// el transformer HR de @lexical/markdown vía TRANSFORMERS), pero al faltar
// acá, $convertFromMarkdownString lanzaba una excepción DENTRO del
// scratchEditor.update() en cuanto encontraba un "---" en el texto pegado
// — y como esa llamada construye el árbol línea por línea dentro de un
// único update(), una excepción a mitad de camino dejaba el árbol
// parcialmente construido / en un estado inválido, lo que corrompía
// silenciosamente TODOS los bloques ya procesados (headings incluidos),
// no solo el "---" que la disparó. Sin este nodo, cualquier documento con
// una sola línea "---" en cualquier parte perdía el texto de sus headings
// aunque el heading en sí no tuviera nada que ver con la regla horizontal.
const SCRATCH_EDITOR_NODES = [
  VariantHeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  LinkNode,
  MathNode,
  HorizontalRuleNode,
  ...TABLE_NODES,
];

// ── Heurística: ¿esto "parece" markdown? ──────────────────────────────
// Deliberadamente conservadora: preferimos NO interceptar texto ambiguo
// (por ej. una frase suelta con un "*" de multiplicación) antes que
// convertir de más y sorprender al usuario. Pedimos evidencia razonable:
// o bien una marca de bloque al inicio de línea (heading/lista/cita/
// código/tabla), o bien un patrón inline claro y repetido (negrita,
// cursiva, link) — una sola ocurrencia aislada de "*" o "_" no cuenta.
// [^\S\n] en vez de \s en el heading/lista/numerada: excluye \n explícitamente
// del "espacio" que separa la marca del contenido. Con \s (que incluye \n),
// "#{1,6}\s+\S" podía cruzar el salto de línea y matchear contra el primer
// carácter no-espacio de la LÍNEA SIGUIENTE — por ejemplo "# \n#" (dos
// headings vacíos seguidos, cada uno "#" + un espacio y nada más) matcheaba
// como si fuera un heading válido con contenido, aunque ninguna línea
// individual lo era. Eso activaba looksLikeMarkdown y $convertFromMarkdownString
// terminaba creando HeadingNodes reales pero completamente vacíos — el
// síntoma exacto de "se pega markdown y no aparece ninguna letra": no había
// letras que pegar, pero tampoco debía haberse interceptado el paste para
// empezar (un "# " suelto, con espacio y nada más, es contenido plano, no
// un heading real).
const BLOCK_MARK_RE = /^(#{1,6}[^\S\n]+\S|>[^\S\n]?\S|```|[-*+][^\S\n]+\S|\d+\.[^\S\n]+\S|\|.+\|\s*$)/m;
const TABLE_SEP_RE = /^\|?[\s:-]+\|[\s:|-]+$/m;
const BOLD_RE = /\*\*[^*\n]+\*\*|__[^_\n]+__/;
const LINK_RE = /\[[^\]\n]+\]\([^)\n]+\)/;
const INLINE_CODE_RE = /`[^`\n]+`/;
const MATH_RE = /\$\$[\s\S]+?\$\$|(?<!\$)\$(?!\s)[^$\n]+?(?<!\s)\$(?!\$)/;

export function looksLikeMarkdown(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Evita disparar en un párrafo plano de una sola línea sin ninguna
  // marca — el caso más común de "pegué texto normal, no markdown".
  if (BLOCK_MARK_RE.test(trimmed)) return true;
  if (TABLE_SEP_RE.test(trimmed)) return true;
  if (BOLD_RE.test(trimmed)) return true;
  if (LINK_RE.test(trimmed)) return true;
  if (MATH_RE.test(trimmed)) return true;
  // Código inline solo cuenta si aparece junto con al menos otra marca
  // débil (evita falsos positivos con texto que usa comillas simples de
  // otro idioma o acentos graves sueltos).
  if (INLINE_CODE_RE.test(trimmed) && /\n/.test(trimmed)) return true;
  return false;
}

// ── Normalización de saltos de línea sueltos ──────────────────────────
// $convertFromMarkdownString sigue la regla estándar de CommonMark: un
// solo "\n" NO separa párrafos, hace falta línea en blanco ("\n\n") entre
// bloques. La mayoría de fuentes de las que la gente copia texto (notas,
// documentos, un mensaje de chat, un README escrito a mano) usan un solo
// salto de línea entre "párrafos" — eso hace que $convertFromMarkdownString
// fusione todo en un único <p> gigante (o, peor, deje que la primera línea
// de una lista "se coma" el resto del texto hasta la próxima línea en
// blanco real, como pasaba con las líneas "- Manifestaciones:" /
// "- Límites:" seguidas de texto plano sin blank line). El síntoma que
// reporta el usuario ("pega pero no se muestra nada") es justo esto:
// el contenido no se pierde de verdad, queda comprimido/mezclado dentro
// de uno o dos nodos y visualmente parece que desapareció.
//
// Estrategia: insertamos una línea en blanco entre dos líneas no-vacías
// consecutivas, EXCEPTO cuando eso rompería una construcción real que
// depende de saltos simples contiguos:
//   - dos líneas de lista del mismo estilo (ambas empiezan con "-"/"*"/
//     "+"/"1.") → se dejan pegadas, así siguen formando una sola lista.
//   - dentro de un bloque ``` ``` → no se toca nada (el contenido es
//     literal, insertar blank lines ahí lo rompería).
//   - dentro de un bloque de tabla ("| ... |" en líneas consecutivas,
//     incluida la fila separadora "---|---") → no se toca, una tabla
//     markdown depende de que sus filas queden una debajo de la otra
//     sin línea en blanco.
//   - si el texto YA usa líneas en blanco entre bloques (markdown más
//     "formal", pegado desde otro editor markdown) esto es un no-op:
//     nunca insertamos una segunda línea en blanco donde ya hay una.
// Marca de heading ATX que aparece EN MEDIO de una línea (no al inicio):
// "... texto ## Siguiente título ...". Esto pasa cuando el origen (Gemini,
// ChatGPT, algunos visores) arma el text/plain del portapapeles colapsando
// varios bloques en una sola línea física, sin ningún "\n" entre ellos —
// típicamente porque en su DOM cada heading es un elemento de bloque
// separado, pero la extracción a texto plano del navegador no inserta
// salto de línea entre bloques adyacentes si el markup de origen no tiene
// un nodo de bloque "real" entre medio (o usa <br> en vez de saltos).
// Sin este paso, normalizeLooseLineBreaks no tiene nada que hacer (opera
// línea por línea) porque a estos efectos TODO el texto pegado es una sola
// "línea": el primer heading termina tragándose los "#"/"##"/"###"
// siguientes como texto literal dentro de sí mismo (el regExp de
// HEADING_TRANSFORMER solo dispara al INICIO de línea), y visualmente se
// ve justo como "aparecen los #, ##, ### pero no hay texto" — el contenido
// real existe, pero está todo concatenado dentro del primer heading, que
// se corta/trunca visualmente por el estilo del heading (una sola línea
// de alto, overflow, etc.).
const MIDLINE_HEADING_RE = /[^\S\n](#{1,6})[^\S\n]+(?=\S)/g;
function splitMidlineHeadings(text: string): string {
  return text.replace(MIDLINE_HEADING_RE, (match, hashes: string, offset: number) => {
    // No tocar si ya está al inicio de la línea (offset 0 o precedido de \n).
    const before = text[offset - 1];
    if (offset === 0 || before === "\n") return match;
    return `\n\n${hashes} `;
  });
}

function normalizeLooseLineBreaks(text: string): string {
  const withSplitHeadings = splitMidlineHeadings(text);
  const lines = withSplitHeadings.split("\n");
  const isListLine = (l: string) => /^\s*([-*+]|\d+\.)\s+\S/.test(l);
  const isTableLine = (l: string) => /^\s*\|.*\|\s*$/.test(l.trim()) || /^\s*\|?[\s:-]+\|[\s:|-]+$/.test(l);
  let inCodeFence = false;

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    out.push(line);

    if (/^\s*```/.test(line)) inCodeFence = !inCodeFence;
    if (inCodeFence) continue; // nunca insertar blank lines dentro de ```

    const next = lines[i + 1];
    if (next === undefined) continue;
    if (line.trim() === "" || next.trim() === "") continue; // ya hay blank line, o es el final

    // Lista contigua del mismo estilo: no separar.
    if (isListLine(line) && isListLine(next)) continue;
    // Tabla contigua: no separar (rompería la tabla).
    if (isTableLine(line) && isTableLine(next)) continue;
    // Encabezado ATX ("# algo") seguido de texto: sí separar (caso normal).

    out.push("");
  }
  return out.join("\n");
}

// ── Red de seguridad: ¿el árbol convertido tiene texto real? ───────────
// Puede pasar que looksLikeMarkdown() de un falso positivo razonable (el
// texto "parece" markdown por su forma) pero que, tras la conversión, el
// resultado no tenga ningún contenido textual — por ejemplo, un heading
// "# " sin texto real después del "#". En ese caso preferimos NO haber
// interceptado el paste: mejor pegar el texto plano tal cual (fallback
// más abajo) que insertar nodos de bloque vacíos silenciosamente, que es
// indistinguible de "no pasó nada" para quien está mirando la pantalla.
function hasRealTextContent(root: any): boolean {
  let found = false;
  const walk = (node: any): void => {
    if (found) return;
    if (node.getType?.() === "text") {
      if (node.getTextContent().trim() !== "") found = true;
      return;
    }
    const children = node.getChildren?.() ?? [];
    for (const child of children) {
      walk(child);
      if (found) return;
    }
  };
  walk(root);
  return found;
}

// ── exportJSON() de un nodo suelto NO incluye children ──────────────────
// Descubierto al debuggear "los headings/párrafos se pierden al pegar":
// ElementNode.exportJSON() en el CORE de Lexical (no algo nuestro, ni
// algo de VariantHeadingNode) devuelve "children: []" hardcodeado por
// diseño — la recursión hacia los hijos es responsabilidad de quien
// arma la serialización completa (normalmente editorState.toJSON(),
// que sí la hace desde afuera, recorriendo el árbol). Llamar
// node.exportJSON() "a mano" sobre un nodo suelto, como hacíamos acá
// (serializedNodes = root.getChildren().map(n => n.exportJSON())),
// SIEMPRE devuelve children vacío sin importar si el nodo es HeadingNode
// base, VariantHeadingNode, ParagraphNode, etc. — confirmado contra
// HeadingNode nativo de @lexical/rich-text sin ningún código propio de
// por medio. Por eso el bug reaparecía incluso después de arreglar
// VariantHeadingNode.importJSON (ese fix sigue siendo necesario para
// cuando llega un JSON con children ya completo desde otra fuente, pero
// acá nunca llegaba completo desde el origen: el propio exportJSON()
// nunca lo puso).
// Fix: función recursiva propia que arma children explícitamente
// bajando por getChildren() y llamando exportNodeJSONDeep en cada hijo.
function exportNodeJSONDeep(node: any): Record<string, unknown> {
  const json = node.exportJSON();
  if (typeof node.getChildren === "function") {
    json.children = node.getChildren().map((child: any) => exportNodeJSONDeep(child));
  }
  return json;
}

// ── Heurística: ¿el HTML pegado es sospechoso de perder texto? ─────────
// Algunos orígenes (visores de markdown, sitios de documentación, algunas
// interfaces de chat) renderizan cada heading con un ícono de anchor-link
// junto al título — típicamente un "#" o "§" clickeable insertado antes o
// después del texto real, ej. <h1><a class="anchor">#</a>Número Atómico</h1>
// o variantes con el ícono en un <span>/<svg> adyacente. El importDOM
// estándar de HeadingNode (@lexical/rich-text, heredado sin cambios por
// VariantHeadingNode) extrae TODO el texto de los nodos hijos del heading.
// Si por la estructura específica del HTML de origen (ej. el título real
// vive en un nodo que Lexical no reconoce como parte del contenido, o hay
// whitespace/anidamiento que rompe la extracción) el resultado termina
// siendo solo el ícono, el heading se pega con "#" y nada más — visualmente
// indistinguible de "no se pegó texto".
//
// En vez de intentar enumerar y filtrar cada patrón de anchor-icon posible
// (frágil: cambia por sitio), comparamos el volumen de texto que el HTML
// produciría contra el texto plano equivalente disponible en el mismo
// portapapeles. Si el HTML da mucho menos texto que el plano para el mismo
// contenido, es señal de pérdida — mejor usar el camino markdown (texto
// plano → $convertFromMarkdownString) que ya sabemos que preserva el
// contenido real, en vez de confiar en el importDOM del HTML.
function htmlLooksLossy(html: string, plainText: string): boolean {
  const plainLen = plainText.replace(/\s+/g, "").length;
  if (plainLen < 20) return false; // texto muy corto: no vale la pena arriesgar falsos positivos
  // Extracción de texto grosera pero suficiente para la comparación: junta
  // el contenido de nodos de bloque típicos, ignora tags y colapsa espacios.
  const approxHtmlText = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, "")
    .length;
  // Si el HTML "aparente" tiene menos de la mitad del texto que el plano
  // equivalente, algo se está perdiendo en el camino HTML — no es un
  // umbral exacto, es deliberadamente generoso para no interceptar HTML
  // legítimo que simplemente formatea distinto (listas, tablas cuentan
  // caracteres distinto entre plano y HTML).
  return approxHtmlText < plainLen * 0.5;
}

// htmlLooksLossy mide FIDELIDAD DE TEXTO (¿el HTML conserva los mismos
// caracteres que el texto plano?) — pero un HTML puede ser 100% fiel en
// texto y aun así ser menos CAPAZ que nuestro camino markdown: el caso
// real es "$$fórmula$$" en bloque. Cuando el origen (Gemini, ChatGPT,
// cualquier <p> que renderiza markdown a HTML) serializa una fórmula
// bloque, el <p> resultante contiene el texto "$$...$$" completo y sin
// pérdida de caracteres — por eso htmlLooksLossy da false, correctamente
// según lo que mide. El problema es que el importDOM nativo de Lexical
// no tiene ningún nodo/transformer que reconozca "$$...$$" dentro de un
// <p> — lo deja tal cual, como texto plano literal. Nuestro camino
// markdown SÍ lo convierte a MathNode real (ver MATH_BLOCK_RE más abajo).
// Por eso, aunque el HTML no sea "lossy" en el sentido de htmlLooksLossy,
// si el texto plano tiene un bloque de fórmula que el HTML no va a poder
// renderizar como fórmula real, preferimos igual el camino markdown.
function htmlMissesMathBlock(plainText: string): boolean {
  // Reseteamos lastIndex por las dudas: MATH_BLOCK_RE es /g y se importa
  // como módulo compartido: si en algún otro lado del código se usó con
  // .test()/.exec() y no se consumió hasta el final, podría quedar con
  // lastIndex != 0. .test() en un string nuevo con /g arrancaría desde
  // ahí y daría falsos negativos intermitentes.
  MATH_BLOCK_RE.lastIndex = 0;
  return MATH_BLOCK_RE.test(plainText);
}

export function MarkdownPastePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const text = clipboardData.getData("text/plain");

        // Si el origen provee HTML enriquecido, por defecto dejamos que el
        // handler default de RichTextPlugin lo procese (ya sabe pegar HTML
        // preservando formato). EXCEPCIÓN: si ese HTML se ve "lossy" frente
        // al texto plano del mismo portapapeles (ver htmlLooksLossy arriba)
        // Y el texto plano sí parece markdown convertible, preferimos nuestro
        // propio camino — más lento pero confiable — en vez de arriesgarnos
        // a que el importDOM de Lexical descarte el contenido real y deje
        // solo un ícono de anchor-link u otro resto no textual.
        if (clipboardData.types.includes("text/html")) {
          const html = clipboardData.getData("text/html");
          const shouldPreferMarkdownPath =
            html &&
            text &&
            (htmlLooksLossy(html, text) || htmlMissesMathBlock(text)) &&
            looksLikeMarkdown(text);
          if (!shouldPreferMarkdownPath) return false;
        }

        if (!text || !looksLikeMarkdown(text)) return false;

        event.preventDefault();

        // -1) Saltos de línea sueltos → líneas en blanco reales entre
        // bloques (ver normalizeLooseLineBreaks arriba). Sin esto,
        // $convertFromMarkdownString fusiona párrafos separados por un
        // solo "\n" en uno solo, o deja que una lista se coma texto
        // plano subsecuente — el bug de "pega pero no se ve nada".
        const normalizedText = normalizeLooseLineBreaks(text);

        // 0) "$$formula$$" en bloque es multilinea (puede contener \n
        // propios del LaTeX, ej: \begin{aligned}...) — igual que las
        // tablas en rawTextToLexicalTree, lo sacamos ANTES de que
        // $convertFromMarkdownString toque el texto, y lo reemplazamos
        // por un token ASCII de una sola palabra que no colisiona con
        // ninguna sintaxis markdown real.
        const mathBlocks: string[] = [];
        const textWithMathTokens = normalizedText.replace(MATH_BLOCK_RE, (_m, formula: string) => {
          const idx = mathBlocks.push(formula.trim()) - 1;
          return `xMathBlockTokenxx${idx}xx`;
        });

        // 1) Editor headless temporal, descartable — el root.clear() que
        // hace $convertFromMarkdownString actúa sobre este documento
        // aislado, nunca sobre el editor real visible en pantalla.
        const scratchEditor = createEditor({ nodes: SCRATCH_EDITOR_NODES });
        let serializedNodes: Array<Record<string, unknown>> = [];

        // try/catch alrededor del update: si $convertFromMarkdownString
        // encuentra una construcción que necesita un tipo de nodo no
        // registrado en SCRATCH_EDITOR_NODES (ver el comentario largo
        // junto a esa constante — HorizontalRuleNode fue un caso real de
        // esto), Lexical lanza una excepción A MITAD del procesamiento
        // línea por línea. Sin este try/catch, esa excepción se propagaba
        // hacia afuera del PASTE_COMMAND, pero el efecto visible más
        // dañino era que el árbol del scratchEditor quedaba en un estado
        // parcial/inconsistente — bloques procesados ANTES del punto de
        // falla podían perder su contenido de texto al leerse después.
        // Con el catch: si algo sale mal acá, tratamos la conversión como
        // fallida por completo (serializedNodes se queda vacío) y el
        // bloque de abajo hace fallback a pegar el texto plano tal cual
        // — degrada a un paste normal en vez de arriesgar corromper
        // silenciosamente bloques que sí se habían procesado bien.
        try {
          scratchEditor.update(
            () => {
              $convertFromMarkdownString(textWithMathTokens, RICH_TRANSFORMERS);

              // Reemplazamos cada token de bloque math por su MathNode
              // real, recorriendo los TextNode resultantes (mismo patrón
              // que resolveTextNode en richTextSerializer.ts).
              //
              // OJO — MathNode con inline:false es un DecoratorNode de
              // BLOQUE (isInline() === false, ver MathNode.tsx): Lexical
              // no lo trata como contenido inline válido dentro de un
              // ElementNode "de línea" como paragraph/heading/list-item.
              // Insertarlo con node.insertBefore()/insertAfter() sobre el
              // TextNode del token (como si fuera texto normal) lo deja
              // "adentro" del paragraph sin quedar realmente adjunto como
              // contenido — el paragraph sobrevive pero su
              // getTextContent() queda vacío: exactamente el síntoma de
              // "se pega, se ven los saltos de línea, pero no hay texto".
              // El fix: si el token de math-bloque es TODO el contenido
              // de su paragraph (antes/después vacíos, caso normal — el
              // "$$...$$" ocupa su propia línea/bloque en el markdown
              // original), sacamos el MathNode como HERMANO de ese
              // paragraph (mismo nivel que heading/paragraph/list en
              // root) y borramos el paragraph que quedó vacío. Si hubiera
              // texto antes/después en la misma línea (caso atípico, ej.
              // "texto $$formula$$ mas texto" todo pegado), preferimos no
              // partir el bloque de forma quirúrgica — dejamos el texto
              // plano de la fórmula tal cual en ese caso raro, en vez de
              // arriesgar un árbol inválido.
              const tokenRe = /xMathBlockTokenxx(\d+)xx/;
              const walk = (node: any): void => {
                if (node.getType?.() === "text") {
                  const content: string = node.getTextContent();
                  const match = tokenRe.exec(content);
                  if (!match) return;
                  const formula = mathBlocks[Number(match[1])];
                  if (formula === undefined) return;
                  const before = content.slice(0, match.index);
                  const after = content.slice(match.index + match[0].length);
                  const mathNode = $createMathNode({ formula, inline: false });

                  const parent = node.getParent?.();
                  const isOnlyContentOfParagraph =
                    !before &&
                    !after &&
                    parent?.getType?.() === "paragraph" &&
                    parent.getChildren().length === 1;

                  if (isOnlyContentOfParagraph) {
                    // Caso normal: "$$...$$" solo en su línea → el
                    // MathNode reemplaza al paragraph entero como nodo
                    // de bloque hermano, no como hijo inline.
                    parent.insertAfter(mathNode);
                    parent.remove();
                    return;
                  }

                  // Caso atípico: hay texto antes/después en la misma
                  // línea que el token, o el padre no es un paragraph
                  // simple. Insertar un nodo de bloque ahí adentro
                  // rompería el invariante inline de Lexical (ver
                  // comentario arriba), así que degradamos a texto
                  // plano legible en vez de un MathNode mal ubicado.
                  const rawFormula = `$$${formula}$$`;
                  if (before) node.insertBefore($createTextNode(before));
                  node.insertBefore($createTextNode(rawFormula));
                  if (after) node.insertBefore($createTextNode(after));
                  node.remove();
                  return;
                }
                const children = node.getChildren?.() ?? [];
                for (const child of [...children]) walk(child);
              };
              walk($getRoot());

              // Ver hasRealTextContent arriba: si tras convertir no quedó
              // ningún texto real, dejamos serializedNodes vacío a propósito
              // — el bloque de abajo hace fallback a texto plano en vez de
              // insertar bloques vacíos.
              if (hasRealTextContent($getRoot())) {
                serializedNodes = $getRoot()
                  .getChildren()
                  .map((n) => exportNodeJSONDeep(n));
              }
            },
            { discrete: true },
          );
        } catch (err) {
          console.warn(
            "[MarkdownPastePlugin] Conversión de markdown falló, fallback a texto plano:",
            err,
          );
          serializedNodes = [];
        }

        if (serializedNodes.length === 0) {
          // No había texto real que convertir (ver hasRealTextContent) o
          // la conversión no produjo nodos: en vez de dejar el paste en
          // silencio (preventDefault ya se llamó), insertamos el texto
          // plano original tal cual, que es el comportamiento que el
          // usuario esperaría de un paste normal.
          if (text.trim() !== "") {
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                selection.insertText(text);
              }
            });
          }
          return true;
        }

        // 2) De vuelta en el editor real: reconstruimos cada nodo desde
        // su JSON y lo insertamos en el punto del cursor. Reconstruir
        // desde JSON en vez de mover instancias directamente evita el
        // problema de "un nodo no puede tener dos editores dueños" entre
        // el editor headless y el real.
        //
        // IMPORTANTE: usamos $parseSerializedNode (no klass.importJSON
        // llamado a mano) porque importJSON de un nodo es responsable
        // ÚNICAMENTE de reconstruirse A SÍ MISMO (tag, formato, indent,
        // etc.) — nunca de sus hijos. Para ElementNode (heading, párrafo,
        // list item, quote...) eso significa que klass.importJSON(json)
        // devuelve el bloque correcto pero VACÍO: el texto que vivía en
        // json.children nunca se reconstruye. Ese era el bug: al pegar
        // markdown se veían los saltos de línea/bloques (el contenedor sí
        // se insertaba) pero el contenido de texto desaparecía. Lexical
        // arma el árbol completo recursivamente vía $parseSerializedNode,
        // que sí procesa children y es el punto de entrada documentado
        // para esto (mismo mecanismo que usa editor.parseEditorState()).
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const rebuilt = serializedNodes
            .map((json) => {
              try {
                return $parseSerializedNode(json as any);
              } catch {
                return null;
              }
            })
            .filter((n): n is NonNullable<typeof n> => n !== null);

          if (rebuilt.length > 0) {
            selection.insertNodes(rebuilt);
          }
        });

        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}
