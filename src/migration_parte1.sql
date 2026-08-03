-- Parte 1: forma/rejilla pasan de config_runas (singleton global) a ser
-- propias de cada combinaciones_runas.

alter table combinaciones_runas
  add column if not exists forma jsonb not null default '{"tipo":"circulo","lados":0}',
  add column if not exists rejilla jsonb not null default '{"secciones":1,"anillos":1}';

-- Opcional: config_runas.forma / config_runas.rejilla quedan sin uso desde
-- el código (solo se sigue leyendo/escribiendo plantillas_separadores ahí).
-- No hace falta borrarlas ahora; si en algún momento se quiere limpiar:
-- alter table config_runas drop column if exists forma;
-- alter table config_runas drop column if exists rejilla;
