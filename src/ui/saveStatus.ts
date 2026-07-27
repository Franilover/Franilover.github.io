/**
 * Estado genérico de guardado para cualquier editor con autosave.
 * Vive en ui/ (no en lib/, no en una entidad) porque es un tipo
 * de la capa de UI compartida entre Garlia y Personal, sin lógica de negocio.
 */
export type SaveStatus = "idle" | "saving" | "saved" | "error";
