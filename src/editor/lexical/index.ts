/**
 * index.ts
 * ────────
 * Barrel de exports del editor Lexical.
 * Importa desde aquí en EditorCapitulos.tsx:
 *
 *   import { RichEditor } from "@/editor/lexical";
 */
export { RichEditor } from "./RichEditor";
export type {
  RichEditorProps,
  RichEditorFormatCommand,
} from "./RichEditor";
export { PlainMarkdownPreview } from "./PlainMarkdownPreview";
export type { PlainMarkdownPreviewProps } from "./PlainMarkdownPreview";

// Nodos (útiles si necesitas crear/inspeccionar nodos fuera del editor)
export {
  $createDropNode,
  $isDropNode,
  dropPayloadToRaw,
  dropRawToPayload,
} from "./nodes/DropNode";
export {
  $createDialogoNode,
  $isDialogoNode,
  dialogoPayloadToRaw,
  dialogoRawToPayload,
} from "./nodes/DialogoNode";
export {
  $createSoundNode,
  $isSoundNode,
  soundPayloadToRaw,
  soundRawToPayload,
} from "./nodes/SoundNode";
export {
  $createImgNode,
  $isImgNode,
  imgPayloadToRaw,
  imgRawToPayload,
} from "./nodes/ImgNode";
export {
  $createChoiceNode,
  $isChoiceNode,
  choicePayloadToRaw,
  choiceRawToPayload,
} from "./nodes/ChoiceNode";
export {
  $createUseNode,
  $isUseNode,
  parseUsePayloadToRaw,
  parseUseRawToPayload,
} from "./nodes/UseNode";
export {
  $createCondicionNode,
  $isCondicionNode,
  condicionPayloadToRaw,
  condicionRawToPayload,
} from "./nodes/CondicionNode";
export {
  $createFlagNode,
  $isFlagNode,
  flagPayloadToRaw,
  flagRawToPayload,
} from "./nodes/FlagNode";
export {
  $createSectionNode,
  $isSectionNode,
  sectionPayloadToRaw,
  sectionRawToPayload,
} from "./nodes/SectionNode";
export {
  $createWikilinkNode,
  $isWikilinkNode,
  wikilinkPayloadToRaw,
  wikilinkRawToPayload,
} from "./nodes/WikilinkNode";

// Serializador (por si necesitas convertir fuera del editor)
export {
  serializeRootToRaw,
  rawTextToLexicalTree,
  insertSnippetNode,
} from "./richTextSerializer";

// Tabla — helper de inserción imperativa (ver TablePlugin.tsx para cómo
// conectar "/tabla" desde SnippetCommandPalette)
export { insertTable } from "./plugins/TablePlugin";

// Tipos compartidos
export type { SnippetEditRequest, SnippetKind } from "./nodes/sharedTypes";
export { lastSnippetClickRect } from "./nodes/sharedTypes";
export type { WikiEntity } from "./WikilinkMenuPanel";
