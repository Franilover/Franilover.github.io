export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      calendario_config: {
        Row: {
          anio_inicio: number
          dias_por_semana: number
          horas_por_dia: number
          id: number
        }
        Insert: {
          anio_inicio?: number
          dias_por_semana?: number
          horas_por_dia?: number
          id?: number
        }
        Update: {
          anio_inicio?: number
          dias_por_semana?: number
          horas_por_dia?: number
          id?: number
        }
        Relationships: []
      }
      calendario_estaciones: {
        Row: {
          duracion_dias: number
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          duracion_dias: number
          id?: string
          nombre: string
          orden: number
        }
        Update: {
          duracion_dias?: number
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      calendario_estaciones_backup: {
        Row: {
          backup_date: string | null
          duracion_dias: number | null
          id: string | null
          nombre: string | null
          orden: number | null
        }
        Insert: {
          backup_date?: string | null
          duracion_dias?: number | null
          id?: string | null
          nombre?: string | null
          orden?: number | null
        }
        Update: {
          backup_date?: string | null
          duracion_dias?: number | null
          id?: string | null
          nombre?: string | null
          orden?: number | null
        }
        Relationships: []
      }
      canciones: {
        Row: {
          cantante: string | null
          ciudad_id: string | null
          compositor: string | null
          created_at: string | null
          dia_absoluto: number | null
          duracion_segundos: number | null
          emocion: string | null
          estado: string | null
          guion_mv: Json | null
          id: string
          idioma: string | null
          info_cancion: string | null
          links: Json | null
          orden_linea_tiempo: number | null
          personaje_id: string | null
          portada_url: string | null
          reino_id: string | null
          tema: string | null
          titulo: string
          updated_at: string | null
          visible: boolean | null
        }
        Insert: {
          cantante?: string | null
          ciudad_id?: string | null
          compositor?: string | null
          created_at?: string | null
          dia_absoluto?: number | null
          duracion_segundos?: number | null
          emocion?: string | null
          estado?: string | null
          guion_mv?: Json | null
          id?: string
          idioma?: string | null
          info_cancion?: string | null
          links?: Json | null
          orden_linea_tiempo?: number | null
          personaje_id?: string | null
          portada_url?: string | null
          reino_id?: string | null
          tema?: string | null
          titulo: string
          updated_at?: string | null
          visible?: boolean | null
        }
        Update: {
          cantante?: string | null
          ciudad_id?: string | null
          compositor?: string | null
          created_at?: string | null
          dia_absoluto?: number | null
          duracion_segundos?: number | null
          emocion?: string | null
          estado?: string | null
          guion_mv?: Json | null
          id?: string
          idioma?: string | null
          info_cancion?: string | null
          links?: Json | null
          orden_linea_tiempo?: number | null
          personaje_id?: string | null
          portada_url?: string | null
          reino_id?: string | null
          tema?: string | null
          titulo?: string
          updated_at?: string | null
          visible?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "canciones_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canciones_personaje_id_fkey"
            columns: ["personaje_id"]
            isOneToOne: false
            referencedRelation: "personajes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canciones_reino_id_fkey"
            columns: ["reino_id"]
            isOneToOne: false
            referencedRelation: "reinos"
            referencedColumns: ["id"]
          },
        ]
      }
      capitulos: {
        Row: {
          ciudades_ids: string[]
          contenido: string | null
          created_at: string
          criaturas_ids: string[] | null
          dia_absoluto: number | null
          fecha_publicacion: string | null
          id: string
          items_ids: string[] | null
          libro_id: string | null
          narrador_id: string | null
          orden: number
          orden_linea_tiempo: number | null
          personajes_ids: string[] | null
          reinos_ids: string[] | null
          titulo_capitulo: string | null
          trigger_warnings: string[]
          visibilidad: string
        }
        Insert: {
          ciudades_ids?: string[]
          contenido?: string | null
          created_at?: string
          criaturas_ids?: string[] | null
          dia_absoluto?: number | null
          fecha_publicacion?: string | null
          id?: string
          items_ids?: string[] | null
          libro_id?: string | null
          narrador_id?: string | null
          orden: number
          orden_linea_tiempo?: number | null
          personajes_ids?: string[] | null
          reinos_ids?: string[] | null
          titulo_capitulo?: string | null
          trigger_warnings?: string[]
          visibilidad?: string
        }
        Update: {
          ciudades_ids?: string[]
          contenido?: string | null
          created_at?: string
          criaturas_ids?: string[] | null
          dia_absoluto?: number | null
          fecha_publicacion?: string | null
          id?: string
          items_ids?: string[] | null
          libro_id?: string | null
          narrador_id?: string | null
          orden?: number
          orden_linea_tiempo?: number | null
          personajes_ids?: string[] | null
          reinos_ids?: string[] | null
          titulo_capitulo?: string | null
          trigger_warnings?: string[]
          visibilidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "capitulos_libro_id_fkey"
            columns: ["libro_id"]
            isOneToOne: false
            referencedRelation: "libros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capitulos_libro_id_fkey"
            columns: ["libro_id"]
            isOneToOne: false
            referencedRelation: "libros_con_reino"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capitulos_narrador_id_fkey"
            columns: ["narrador_id"]
            isOneToOne: false
            referencedRelation: "personajes"
            referencedColumns: ["id"]
          },
        ]
      }
      capitulos_leidos: {
        Row: {
          capitulo_id: string
          id: string
          leido_at: string
          libro_id: string
          perfil_id: string
        }
        Insert: {
          capitulo_id: string
          id?: string
          leido_at?: string
          libro_id: string
          perfil_id: string
        }
        Update: {
          capitulo_id?: string
          id?: string
          leido_at?: string
          libro_id?: string
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capitulos_leidos_capitulo_id_fkey"
            columns: ["capitulo_id"]
            isOneToOne: false
            referencedRelation: "capitulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capitulos_leidos_libro_id_fkey"
            columns: ["libro_id"]
            isOneToOne: false
            referencedRelation: "libros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capitulos_leidos_libro_id_fkey"
            columns: ["libro_id"]
            isOneToOne: false
            referencedRelation: "libros_con_reino"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          id: string
          inserted_at: string
          nombre: string
          user_id: string | null
        }
        Insert: {
          id?: string
          inserted_at?: string
          nombre: string
          user_id?: string | null
        }
        Update: {
          id?: string
          inserted_at?: string
          nombre?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ciudades: {
        Row: {
          coord_x: number | null
          coord_y: number | null
          created_at: string
          descripcion: string | null
          historia: string | null
          id: string
          imagen_url: string | null
          nombre: string
          reino_id: string | null
          secretos: string | null
          tile_col: number | null
          tile_row: number | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          coord_x?: number | null
          coord_y?: number | null
          created_at?: string
          descripcion?: string | null
          historia?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          reino_id?: string | null
          secretos?: string | null
          tile_col?: number | null
          tile_row?: number | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          coord_x?: number | null
          coord_y?: number | null
          created_at?: string
          descripcion?: string | null
          historia?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          reino_id?: string | null
          secretos?: string | null
          tile_col?: number | null
          tile_row?: number | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ciudades_reino_id_fkey"
            columns: ["reino_id"]
            isOneToOne: false
            referencedRelation: "reinos"
            referencedColumns: ["id"]
          },
        ]
      }
      ciudades_desbloqueadas: {
        Row: {
          ciudad_id: string
          desbloqueado_en: string
          user_id: string
        }
        Insert: {
          ciudad_id: string
          desbloqueado_en?: string
          user_id: string
        }
        Update: {
          ciudad_id?: string
          desbloqueado_en?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ciudades_desbloqueadas_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
        ]
      }
      compras: {
        Row: {
          cantidad_comprada: string | null
          created_at: string
          id: string
          ingrediente_id: string | null
          lugar_compra: string | null
          precio_pagado: number
          user_id: string | null
        }
        Insert: {
          cantidad_comprada?: string | null
          created_at?: string
          id?: string
          ingrediente_id?: string | null
          lugar_compra?: string | null
          precio_pagado: number
          user_id?: string | null
        }
        Update: {
          cantidad_comprada?: string | null
          created_at?: string
          id?: string
          ingrediente_id?: string | null
          lugar_compra?: string | null
          precio_pagado?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compras_ingrediente_id_fkey"
            columns: ["ingrediente_id"]
            isOneToOne: false
            referencedRelation: "ingredientes"
            referencedColumns: ["id"]
          },
        ]
      }
      config_mapa: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value?: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      criatura_ciudades: {
        Row: {
          ciudad_id: string | null
          criatura_id: string | null
          id: string
        }
        Insert: {
          ciudad_id?: string | null
          criatura_id?: string | null
          id?: string
        }
        Update: {
          ciudad_id?: string | null
          criatura_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "criatura_ciudades_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criatura_ciudades_criatura_id_fkey"
            columns: ["criatura_id"]
            isOneToOne: false
            referencedRelation: "criaturas"
            referencedColumns: ["id"]
          },
        ]
      }
      criatura_drops: {
        Row: {
          criatura_id: string
          id: string
          item_id: string
          variante_id: string | null
        }
        Insert: {
          criatura_id: string
          id?: string
          item_id: string
          variante_id?: string | null
        }
        Update: {
          criatura_id?: string
          id?: string
          item_id?: string
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "criatura_drops_criatura_id_fkey"
            columns: ["criatura_id"]
            isOneToOne: false
            referencedRelation: "criaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criatura_drops_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criatura_drops_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "criatura_variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      criatura_minerales: {
        Row: {
          criatura_id: string
          id: string
          mineral_id: string
        }
        Insert: {
          criatura_id: string
          id?: string
          mineral_id: string
        }
        Update: {
          criatura_id?: string
          id?: string
          mineral_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "criatura_minerales_criatura_id_fkey"
            columns: ["criatura_id"]
            isOneToOne: false
            referencedRelation: "criaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criatura_minerales_mineral_id_fkey"
            columns: ["mineral_id"]
            isOneToOne: false
            referencedRelation: "minerales"
            referencedColumns: ["id"]
          },
        ]
      }
      criatura_plantas: {
        Row: {
          criatura_id: string
          id: string
          planta_id: string
        }
        Insert: {
          criatura_id: string
          id?: string
          planta_id: string
        }
        Update: {
          criatura_id?: string
          id?: string
          planta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "criatura_plantas_criatura_id_fkey"
            columns: ["criatura_id"]
            isOneToOne: false
            referencedRelation: "criaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criatura_plantas_planta_id_fkey"
            columns: ["planta_id"]
            isOneToOne: false
            referencedRelation: "plantas"
            referencedColumns: ["id"]
          },
        ]
      }
      criatura_reinos: {
        Row: {
          criatura_id: string | null
          id: string
          reino_id: string | null
        }
        Insert: {
          criatura_id?: string | null
          id?: string
          reino_id?: string | null
        }
        Update: {
          criatura_id?: string | null
          id?: string
          reino_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "criatura_reinos_criatura_id_fkey"
            columns: ["criatura_id"]
            isOneToOne: false
            referencedRelation: "criaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criatura_reinos_reino_id_fkey"
            columns: ["reino_id"]
            isOneToOne: false
            referencedRelation: "reinos"
            referencedColumns: ["id"]
          },
        ]
      }
      criatura_variantes: {
        Row: {
          created_at: string | null
          criatura_id: string | null
          descripcion: string | null
          id: string
          imagen_url: string | null
          notas: string | null
          tipo: string
        }
        Insert: {
          created_at?: string | null
          criatura_id?: string | null
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          notas?: string | null
          tipo: string
        }
        Update: {
          created_at?: string | null
          criatura_id?: string | null
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          notas?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "criatura_variantes_criatura_id_fkey"
            columns: ["criatura_id"]
            isOneToOne: false
            referencedRelation: "criaturas"
            referencedColumns: ["id"]
          },
        ]
      }
      criaturas: {
        Row: {
          alma: string | null
          biologia: string | null
          ciudad_id: string | null
          comportamiento: string | null
          created_at: string
          descripcion: string | null
          habitat: string | null
          id: string
          imagen_url: string | null
          magia: string | null
          nombre: string
          pensamiento: string | null
          relacion: string | null
          updated_at: string
        }
        Insert: {
          alma?: string | null
          biologia?: string | null
          ciudad_id?: string | null
          comportamiento?: string | null
          created_at?: string
          descripcion?: string | null
          habitat?: string | null
          id?: string
          imagen_url?: string | null
          magia?: string | null
          nombre: string
          pensamiento?: string | null
          relacion?: string | null
          updated_at?: string
        }
        Update: {
          alma?: string | null
          biologia?: string | null
          ciudad_id?: string | null
          comportamiento?: string | null
          created_at?: string
          descripcion?: string | null
          habitat?: string | null
          id?: string
          imagen_url?: string | null
          magia?: string | null
          nombre?: string
          pensamiento?: string | null
          relacion?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "criaturas_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
        ]
      }
      cronologia_backup: {
        Row: {
          backup_date: string | null
          created_at: string | null
          descripcion: string | null
          id: string | null
          imagen_url: string | null
          orden: number | null
          Reino: string | null
          titulo: string | null
        }
        Insert: {
          backup_date?: string | null
          created_at?: string | null
          descripcion?: string | null
          id?: string | null
          imagen_url?: string | null
          orden?: number | null
          Reino?: string | null
          titulo?: string | null
        }
        Update: {
          backup_date?: string | null
          created_at?: string | null
          descripcion?: string | null
          id?: string | null
          imagen_url?: string | null
          orden?: number | null
          Reino?: string | null
          titulo?: string | null
        }
        Relationships: []
      }
      descubrimientos_criaturas: {
        Row: {
          criatura_id: string | null
          fecha_descubrimiento: string | null
          id: string
          perfil_id: string | null
        }
        Insert: {
          criatura_id?: string | null
          fecha_descubrimiento?: string | null
          id?: string
          perfil_id?: string | null
        }
        Update: {
          criatura_id?: string | null
          fecha_descubrimiento?: string | null
          id?: string
          perfil_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "descubrimientos_criaturas_criatura_id_fkey"
            columns: ["criatura_id"]
            isOneToOne: false
            referencedRelation: "criaturas"
            referencedColumns: ["id"]
          },
        ]
      }
      // ⚠️ Tabla nueva — todavía no existe en la base real. Falta correr la
      // migración SQL en Supabase (ver también flags_narrativos más abajo):
      //
      //   create table nodo_posiciones (
      //     id uuid primary key default gen_random_uuid(),
      //     capitulo_id uuid references capitulos(id) on delete cascade,
      //     node_id text not null,
      //     x double precision not null,
      //     y double precision not null,
      //     updated_at timestamptz default now(),
      //     unique (capitulo_id, node_id)
      //   );
      //
      // Es data de autor (posiciones del editor visual), no de lector — sin
      // RLS por perfil de lector; las mismas políticas que ya protegen el
      // acceso a la tabla `capitulos` alcanzan acá.
      nodo_posiciones: {
        Row: {
          id: string
          capitulo_id: string | null
          node_id: string
          x: number
          y: number
          updated_at: string | null
        }
        Insert: {
          id?: string
          capitulo_id?: string | null
          node_id: string
          x: number
          y: number
          updated_at?: string | null
        }
        Update: {
          id?: string
          capitulo_id?: string | null
          node_id?: string
          x?: number
          y?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      // ⚠️ Tabla nueva — todavía no existe en la base real. Falta correr la
      // migración SQL en Supabase antes de que este tipo sea válido:
      //
      //   create table flags_narrativos (
      //     id uuid primary key default gen_random_uuid(),
      //     perfil_id uuid references perfiles(id),
      //     flag_id text not null,
      //     valor text not null,
      //     updated_at timestamptz default now(),
      //     unique (perfil_id, flag_id)
      //   );
      //
      // (nombre de la tabla de perfiles asumido como "perfiles" — ajustar el
      // FK si el proyecto usa otro nombre real).
      flags_narrativos: {
        Row: {
          id: string
          perfil_id: string | null
          flag_id: string
          valor: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          perfil_id?: string | null
          flag_id: string
          valor: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          perfil_id?: string | null
          flag_id?: string
          valor?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      descubrimientos_items: {
        Row: {
          fecha_descubrimiento: string | null
          id: string
          item_id: string | null
          perfil_id: string | null
        }
        Insert: {
          fecha_descubrimiento?: string | null
          id?: string
          item_id?: string | null
          perfil_id?: string | null
        }
        Update: {
          fecha_descubrimiento?: string | null
          id?: string
          item_id?: string | null
          perfil_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "descubrimientos_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      descubrimientos_personajes: {
        Row: {
          fecha_descubrimiento: string | null
          id: string
          perfil_id: string | null
          personaje_id: string | null
        }
        Insert: {
          fecha_descubrimiento?: string | null
          id?: string
          perfil_id?: string | null
          personaje_id?: string | null
        }
        Update: {
          fecha_descubrimiento?: string | null
          id?: string
          perfil_id?: string | null
          personaje_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "descubrimientos_personajes_personaje_id_fkey"
            columns: ["personaje_id"]
            isOneToOne: false
            referencedRelation: "personajes"
            referencedColumns: ["id"]
          },
        ]
      }
      descubrimientos_reinos: {
        Row: {
          fecha_descubrimiento: string | null
          id: string
          perfil_id: string | null
          reino_id: string | null
        }
        Insert: {
          fecha_descubrimiento?: string | null
          id?: string
          perfil_id?: string | null
          reino_id?: string | null
        }
        Update: {
          fecha_descubrimiento?: string | null
          id?: string
          perfil_id?: string | null
          reino_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "descubrimientos_reinos_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "descubrimientos_reinos_reino_id_fkey"
            columns: ["reino_id"]
            isOneToOne: false
            referencedRelation: "reinos"
            referencedColumns: ["id"]
          },
        ]
      }
      diario_fotos: {
        Row: {
          categoria: string | null
          created_at: string | null
          fecha: string
          id: number
          url_imagen: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          fecha: string
          id?: never
          url_imagen: string
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          fecha?: string
          id?: never
          url_imagen?: string
        }
        Relationships: []
      }
      dibujos: {
        Row: {
          categoria: string | null
          created_at: string | null
          id: number
          titulo: string
          url_imagen: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          id?: number
          titulo: string
          url_imagen: string
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          id?: number
          titulo?: string
          url_imagen?: string
        }
        Relationships: []
      }
      don_criaturas: {
        Row: {
          criatura_id: string | null
          don_id: string | null
          id: string
          variante_id: string | null
        }
        Insert: {
          criatura_id?: string | null
          don_id?: string | null
          id?: string
          variante_id?: string | null
        }
        Update: {
          criatura_id?: string | null
          don_id?: string | null
          id?: string
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "don_criaturas_criatura_id_fkey"
            columns: ["criatura_id"]
            isOneToOne: false
            referencedRelation: "criaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "don_criaturas_don_id_fkey"
            columns: ["don_id"]
            isOneToOne: false
            referencedRelation: "dones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "don_criaturas_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "criatura_variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      dotes_dnd: {
        Row: {
          id: string
          nombre: string
          descripcion: string | null
          categoria: string
          prerequisito: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          categoria?: string
          prerequisito?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          descripcion?: string | null
          categoria?: string
          prerequisito?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      dones: {
        Row: {
          created_at: string | null
          criatura_id: string | null
          explicacion: string | null
          grupo_ids: string[] | null
          id: string
          imagen_url: string | null
          nombre: string
          updated_at: string | null
          variante_id: string | null
        }
        Insert: {
          created_at?: string | null
          criatura_id?: string | null
          explicacion?: string | null
          grupo_ids?: string[] | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          updated_at?: string | null
          variante_id?: string | null
        }
        Update: {
          created_at?: string | null
          criatura_id?: string | null
          explicacion?: string | null
          grupo_ids?: string[] | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          updated_at?: string | null
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dones_criatura_id_fkey"
            columns: ["criatura_id"]
            isOneToOne: false
            referencedRelation: "criaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dones_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "criatura_variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      ejercicios_rutina: {
        Row: {
          descanso: number | null
          id: string
          musculo: string | null
          nombre: string
          notas: string | null
          orden: number | null
          reps: string | null
          rutina_id: string | null
          series: number | null
        }
        Insert: {
          descanso?: number | null
          id?: string
          musculo?: string | null
          nombre: string
          notas?: string | null
          orden?: number | null
          reps?: string | null
          rutina_id?: string | null
          series?: number | null
        }
        Update: {
          descanso?: number | null
          id?: string
          musculo?: string | null
          nombre?: string
          notas?: string | null
          orden?: number | null
          reps?: string | null
          rutina_id?: string | null
          series?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ejercicios_rutina_rutina_id_fkey"
            columns: ["rutina_id"]
            isOneToOne: false
            referencedRelation: "rutinas"
            referencedColumns: ["id"]
          },
        ]
      }
      ensayos: {
        Row: {
          autor: string | null
          calificacion: number | null
          categoria_id: string | null
          citas: Json | null
          contenido: string | null
          id: string
          isbn: string | null
          pagina_actual: number | null
          paginas_total: number | null
          palabras_nuevas: Json | null
          tags: string[] | null
          titulo: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          autor?: string | null
          calificacion?: number | null
          categoria_id?: string | null
          citas?: Json | null
          contenido?: string | null
          id?: string
          isbn?: string | null
          pagina_actual?: number | null
          paginas_total?: number | null
          palabras_nuevas?: Json | null
          tags?: string[] | null
          titulo: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          autor?: string | null
          calificacion?: number | null
          categoria_id?: string | null
          citas?: Json | null
          contenido?: string | null
          id?: string
          isbn?: string | null
          pagina_actual?: number | null
          paginas_total?: number | null
          palabras_nuevas?: Json | null
          tags?: string[] | null
          titulo?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ensayos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      eras_mundo: {
        Row: {
          anio_fin: number | null
          anio_inicio: number
          color: string | null
          descripcion: string | null
          id: string
          nombre: string
          orden: number | null
        }
        Insert: {
          anio_fin?: number | null
          anio_inicio: number
          color?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          orden?: number | null
        }
        Update: {
          anio_fin?: number | null
          anio_inicio?: number
          color?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          orden?: number | null
        }
        Relationships: []
      }
      eventos: {
        Row: {
          created_at: string
          descripcion: string | null
          fecha: string
          hora_inicio: string | null
          id: string
          tipo: string | null
          titulo: string
          username: string | null
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          fecha: string
          hora_inicio?: string | null
          id?: string
          tipo?: string | null
          titulo: string
          username?: string | null
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          fecha?: string
          hora_inicio?: string | null
          id?: string
          tipo?: string | null
          titulo?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_username_fkey"
            columns: ["username"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["username"]
          },
        ]
      }
      eventos_mundo: {
        Row: {
          created_at: string | null
          descripcion: string | null
          dia_absoluto: number
          id: string
          reino_id: string | null
          source: string
          titulo: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          dia_absoluto: number
          id?: string
          reino_id?: string | null
          source?: string
          titulo?: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          dia_absoluto?: number
          id?: string
          reino_id?: string | null
          source?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_mundo_reino_id_fkey"
            columns: ["reino_id"]
            isOneToOne: false
            referencedRelation: "reinos"
            referencedColumns: ["id"]
          },
        ]
      }
      galeria: {
        Row: {
          aspect_ratio: string
          bg_color: string | null
          creado_en: string | null
          id: number
          orden: number | null
          url_imagen: string
        }
        Insert: {
          aspect_ratio?: string
          bg_color?: string | null
          creado_en?: string | null
          id?: number
          orden?: number | null
          url_imagen: string
        }
        Update: {
          aspect_ratio?: string
          bg_color?: string | null
          creado_en?: string | null
          id?: number
          orden?: number | null
          url_imagen?: string
        }
        Relationships: []
      }
      grupos_mundo: {
        Row: {
          created_at: string
          descripcion: string | null
          dote_origen: string | null
          dote_origen_id: string | null
          habilidades_a_elegir: number | null
          habilidades_disponibles: string[] | null
          id: string
          miembro_ids: string[]
          nombre: string
          salvaciones_clase: string[] | null
          subtipo: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          dote_origen?: string | null
          dote_origen_id?: string | null
          habilidades_a_elegir?: number | null
          habilidades_disponibles?: string[] | null
          id?: string
          miembro_ids?: string[]
          nombre?: string
          salvaciones_clase?: string[] | null
          subtipo?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          dote_origen?: string | null
          dote_origen_id?: string | null
          habilidades_a_elegir?: number | null
          habilidades_disponibles?: string[] | null
          id?: string
          miembro_ids?: string[]
          nombre?: string
          salvaciones_clase?: string[] | null
          subtipo?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupos_mundo_dote_origen_id_fkey"
            columns: ["dote_origen_id"]
            isOneToOne: false
            referencedRelation: "dotes_dnd"
            referencedColumns: ["id"]
          },
        ]
      }
      hechizo_criaturas: {
        Row: {
          criatura_id: string | null
          hechizo_id: string | null
          id: string
          variante_id: string | null
        }
        Insert: {
          criatura_id?: string | null
          hechizo_id?: string | null
          id?: string
          variante_id?: string | null
        }
        Update: {
          criatura_id?: string | null
          hechizo_id?: string | null
          id?: string
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hechizo_criaturas_criatura_id_fkey"
            columns: ["criatura_id"]
            isOneToOne: false
            referencedRelation: "criaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hechizo_criaturas_hechizo_id_fkey"
            columns: ["hechizo_id"]
            isOneToOne: false
            referencedRelation: "hechizos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hechizo_criaturas_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "criatura_variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      hechizos: {
        Row: {
          created_at: string | null
          criatura_id: string | null
          explicacion: string | null
          grupo_ids: string[] | null
          id: string
          imagen_url: string | null
          nombre: string
          updated_at: string | null
          variante_id: string | null
        }
        Insert: {
          created_at?: string | null
          criatura_id?: string | null
          explicacion?: string | null
          grupo_ids?: string[] | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          updated_at?: string | null
          variante_id?: string | null
        }
        Update: {
          created_at?: string | null
          criatura_id?: string | null
          explicacion?: string | null
          grupo_ids?: string[] | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          updated_at?: string | null
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hechizos_criatura_id_fkey"
            columns: ["criatura_id"]
            isOneToOne: false
            referencedRelation: "criaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hechizos_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "criatura_variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      hobbys: {
        Row: {
          color: number
          created_at: string
          emoji: string
          freq_dia: number
          freq_sem: number
          icon: string
          id: string
          nombre: string
          nota: string | null
          orden: number
          user_id: string | null
        }
        Insert: {
          color?: number
          created_at?: string
          emoji?: string
          freq_dia?: number
          freq_sem?: number
          icon?: string
          id?: string
          nombre: string
          nota?: string | null
          orden?: number
          user_id?: string | null
        }
        Update: {
          color?: number
          created_at?: string
          emoji?: string
          freq_dia?: number
          freq_sem?: number
          icon?: string
          id?: string
          nombre?: string
          nota?: string | null
          orden?: number
          user_id?: string | null
        }
        Relationships: []
      }
      hobbys_registros: {
        Row: {
          dias: boolean[]
          hobby_id: string | null
          id: string
          semana: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          dias?: boolean[]
          hobby_id?: string | null
          id?: string
          semana: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          dias?: boolean[]
          hobby_id?: string | null
          id?: string
          semana?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hobbys_registros_hobby_id_fkey"
            columns: ["hobby_id"]
            isOneToOne: false
            referencedRelation: "hobbys"
            referencedColumns: ["id"]
          },
        ]
      }
      horario: {
        Row: {
          actividad: string
          created_at: string | null
          dias_semana: number[] | null
          hora_fin: string
          hora_inicio: string
          id: string
          user_id: string | null
        }
        Insert: {
          actividad: string
          created_at?: string | null
          dias_semana?: number[] | null
          hora_fin: string
          hora_inicio: string
          id?: string
          user_id?: string | null
        }
        Update: {
          actividad?: string
          created_at?: string | null
          dias_semana?: number[] | null
          hora_fin?: string
          hora_inicio?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ingredientes: {
        Row: {
          agua_ml: number | null
          carbohidratos: number | null
          categoria: string | null
          created_at: string
          fibra: number | null
          grasas: number | null
          id: string
          kcal: number | null
          nombre: string
          porcion_texto: string | null
          precio: number | null
          proteinas: number | null
          sodio: number | null
          stock_actual: number | null
          user_id: string | null
        }
        Insert: {
          agua_ml?: number | null
          carbohidratos?: number | null
          categoria?: string | null
          created_at?: string
          fibra?: number | null
          grasas?: number | null
          id?: string
          kcal?: number | null
          nombre: string
          porcion_texto?: string | null
          precio?: number | null
          proteinas?: number | null
          sodio?: number | null
          stock_actual?: number | null
          user_id?: string | null
        }
        Update: {
          agua_ml?: number | null
          carbohidratos?: number | null
          categoria?: string | null
          created_at?: string
          fibra?: number | null
          grasas?: number | null
          id?: string
          kcal?: number | null
          nombre?: string
          porcion_texto?: string | null
          precio?: number | null
          proteinas?: number | null
          sodio?: number | null
          stock_actual?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      inventario_usuario: {
        Row: {
          cantidad: number | null
          conseguido_el: string | null
          equipado: boolean | null
          id: string
          item_id: string | null
          perfil_id: string | null
        }
        Insert: {
          cantidad?: number | null
          conseguido_el?: string | null
          equipado?: boolean | null
          id?: string
          item_id?: string | null
          perfil_id?: string | null
        }
        Update: {
          cantidad?: number | null
          conseguido_el?: string | null
          equipado?: boolean | null
          id?: string
          item_id?: string | null
          perfil_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventario_usuario_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_usuario_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_ciudades: {
        Row: {
          ciudad_id: string | null
          id: string
          item_id: string | null
        }
        Insert: {
          ciudad_id?: string | null
          id?: string
          item_id?: string | null
        }
        Update: {
          ciudad_id?: string | null
          id?: string
          item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_ciudades_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_ciudades_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_crafteres: {
        Row: {
          criatura_id: string | null
          id: string
          item_id: string | null
        }
        Insert: {
          criatura_id?: string | null
          id?: string
          item_id?: string | null
        }
        Update: {
          criatura_id?: string | null
          id?: string
          item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_crafteres_criatura_id_fkey"
            columns: ["criatura_id"]
            isOneToOne: false
            referencedRelation: "criaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_crafteres_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_lugares: {
        Row: {
          id: string
          item_id: string | null
          lugar_id: string | null
        }
        Insert: {
          id?: string
          item_id?: string | null
          lugar_id?: string | null
        }
        Update: {
          id?: string
          item_id?: string | null
          lugar_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_lugares_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_lugares_lugar_id_fkey"
            columns: ["lugar_id"]
            isOneToOne: false
            referencedRelation: "lugares"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          categoria: string | null
          ciudad_id: string | null
          created_at: string
          criatura_id: string | null
          descripcion: string | null
          id: string
          imagen_url: string | null
          nombre: string
          origen: string | null
          reino_ids: string[] | null
          sub_origen: string | null
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          ciudad_id?: string | null
          created_at?: string
          criatura_id?: string | null
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre: string
          origen?: string | null
          reino_ids?: string[] | null
          sub_origen?: string | null
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          ciudad_id?: string | null
          created_at?: string
          criatura_id?: string | null
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          origen?: string | null
          reino_ids?: string[] | null
          sub_origen?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_criatura_id_fkey"
            columns: ["criatura_id"]
            isOneToOne: false
            referencedRelation: "criaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
        ]
      }
      libros: {
        Row: {
          categoria: string | null
          created_at: string
          estado: string
          fecha_proximo_capitulo: string | null
          fecha_publicacion: string | null
          id: string
          portada_url: string | null
          reino_id: string | null
          sinopsis: string | null
          titulo: string
          trigger_warnings: string[]
          visibilidad: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          estado?: string
          fecha_proximo_capitulo?: string | null
          fecha_publicacion?: string | null
          id?: string
          portada_url?: string | null
          reino_id?: string | null
          sinopsis?: string | null
          titulo: string
          trigger_warnings?: string[]
          visibilidad?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          estado?: string
          fecha_proximo_capitulo?: string | null
          fecha_publicacion?: string | null
          id?: string
          portada_url?: string | null
          reino_id?: string | null
          sinopsis?: string | null
          titulo?: string
          trigger_warnings?: string[]
          visibilidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "libros_reino_id_fkey"
            columns: ["reino_id"]
            isOneToOne: false
            referencedRelation: "reinos"
            referencedColumns: ["id"]
          },
        ]
      }
      lugares: {
        Row: {
          created_at: string
          descripcion: string | null
          historia: string | null
          id: string
          imagen_url: string | null
          nombre: string
          reino_id: string | null
          secretos: string | null
          tipo: string | null
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          historia?: string | null
          id?: string
          imagen_url?: string | null
          nombre: string
          reino_id?: string | null
          secretos?: string | null
          tipo?: string | null
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          historia?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          reino_id?: string | null
          secretos?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lugares_reino_id_fkey"
            columns: ["reino_id"]
            isOneToOne: false
            referencedRelation: "reinos"
            referencedColumns: ["id"]
          },
        ]
      }
      lugares_desbloqueados: {
        Row: {
          desbloqueado_en: string
          lugar_id: string
          user_id: string
        }
        Insert: {
          desbloqueado_en?: string
          lugar_id: string
          user_id: string
        }
        Update: {
          desbloqueado_en?: string
          lugar_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lugares_desbloqueados_lugar_id_fkey"
            columns: ["lugar_id"]
            isOneToOne: false
            referencedRelation: "lugares"
            referencedColumns: ["id"]
          },
        ]
      }
      map_tiles: {
        Row: {
          col: number
          created_at: string
          id: string
          image_url: string | null
          label: string | null
          order: number
          row: number
          updated_at: string
          world_id: string
        }
        Insert: {
          col: number
          created_at?: string
          id?: string
          image_url?: string | null
          label?: string | null
          order?: number
          row: number
          updated_at?: string
          world_id?: string
        }
        Update: {
          col?: number
          created_at?: string
          id?: string
          image_url?: string | null
          label?: string | null
          order?: number
          row?: number
          updated_at?: string
          world_id?: string
        }
        Relationships: []
      }
      mineral_ciudades: {
        Row: {
          ciudad_id: string
          id: string
          mineral_id: string
        }
        Insert: {
          ciudad_id: string
          id?: string
          mineral_id: string
        }
        Update: {
          ciudad_id?: string
          id?: string
          mineral_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mineral_ciudades_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mineral_ciudades_mineral_id_fkey"
            columns: ["mineral_id"]
            isOneToOne: false
            referencedRelation: "minerales"
            referencedColumns: ["id"]
          },
        ]
      }
      mineral_lugares: {
        Row: {
          id: string
          lugar_id: string
          mineral_id: string
        }
        Insert: {
          id?: string
          lugar_id: string
          mineral_id: string
        }
        Update: {
          id?: string
          lugar_id?: string
          mineral_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mineral_lugares_lugar_id_fkey"
            columns: ["lugar_id"]
            isOneToOne: false
            referencedRelation: "lugares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mineral_lugares_mineral_id_fkey"
            columns: ["mineral_id"]
            isOneToOne: false
            referencedRelation: "minerales"
            referencedColumns: ["id"]
          },
        ]
      }
      minerales: {
        Row: {
          categoria: string | null
          created_at: string
          descripcion: string | null
          id: string
          imagen_url: string | null
          nombre: string
          reino_ids: string[]
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          reino_ids?: string[]
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          reino_ids?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      mision_entidades: {
        Row: {
          entidad_id: string
          id: string
          mision_id: string
          rol: string
          tipo: string
        }
        Insert: {
          entidad_id: string
          id?: string
          mision_id: string
          rol?: string
          tipo: string
        }
        Update: {
          entidad_id?: string
          id?: string
          mision_id?: string
          rol?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mision_entidades_mision_id_fkey"
            columns: ["mision_id"]
            isOneToOne: false
            referencedRelation: "misiones"
            referencedColumns: ["id"]
          },
        ]
      }
      misiones: {
        Row: {
          activa: boolean
          categoria: string | null
          creado_en: string
          descripcion: string | null
          dificultad: string
          id: string
          imagen_url: string | null
          recompensa_item_id: string | null
          recompensa_item_imagen_url: string | null
          recompensa_item_nombre: string | null
          recompensa_monedas: number
          recompensa_xp: number
          requisitos: string | null
          titulo: string
          vence_en: string | null
        }
        Insert: {
          activa?: boolean
          categoria?: string | null
          creado_en?: string
          descripcion?: string | null
          dificultad?: string
          id?: string
          imagen_url?: string | null
          recompensa_item_id?: string | null
          recompensa_item_imagen_url?: string | null
          recompensa_item_nombre?: string | null
          recompensa_monedas?: number
          recompensa_xp?: number
          requisitos?: string | null
          titulo: string
          vence_en?: string | null
        }
        Update: {
          activa?: boolean
          categoria?: string | null
          creado_en?: string
          descripcion?: string | null
          dificultad?: string
          id?: string
          imagen_url?: string | null
          recompensa_item_id?: string | null
          recompensa_item_imagen_url?: string | null
          recompensa_item_nombre?: string | null
          recompensa_monedas?: number
          recompensa_xp?: number
          requisitos?: string | null
          titulo?: string
          vence_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "misiones_recompensa_item_id_fkey"
            columns: ["recompensa_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      misiones_usuario: {
        Row: {
          estado: string
          fecha_aceptada: string
          fecha_completada: string | null
          id: string
          mision_id: string
          progreso: number
          user_id: string
        }
        Insert: {
          estado?: string
          fecha_aceptada?: string
          fecha_completada?: string | null
          id?: string
          mision_id: string
          progreso?: number
          user_id: string
        }
        Update: {
          estado?: string
          fecha_aceptada?: string
          fecha_completada?: string | null
          id?: string
          mision_id?: string
          progreso?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "misiones_usuario_mision_id_fkey"
            columns: ["mision_id"]
            isOneToOne: false
            referencedRelation: "misiones"
            referencedColumns: ["id"]
          },
        ]
      }
      mundo_secciones: {
        Row: {
          contenido: string | null
          key: string
          updated_at: string | null
        }
        Insert: {
          contenido?: string | null
          key: string
          updated_at?: string | null
        }
        Update: {
          contenido?: string | null
          key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      notas: {
        Row: {
          contenido: string | null
          created_at: string | null
          etiquetas: string | null
          id: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          contenido?: string | null
          created_at?: string | null
          etiquetas?: string | null
          id?: string
          titulo?: string
          updated_at?: string | null
        }
        Update: {
          contenido?: string | null
          created_at?: string | null
          etiquetas?: string | null
          id?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pendientes_categorias: {
        Row: {
          color: number
          icon: string
          id: string
          nombre: string
          orden: number
          user_id: string | null
        }
        Insert: {
          color?: number
          icon: string
          id?: string
          nombre: string
          orden?: number
          user_id?: string | null
        }
        Update: {
          color?: number
          icon?: string
          id?: string
          nombre?: string
          orden?: number
          user_id?: string | null
        }
        Relationships: []
      }
      pendientes_items: {
        Row: {
          categoria_id: string | null
          created_at: string | null
          hecho: boolean
          id: string
          nota: string | null
          orden: number
          titulo: string
          url: string | null
          user_id: string | null
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string | null
          hecho?: boolean
          id?: string
          nota?: string | null
          orden?: number
          titulo: string
          url?: string | null
          user_id?: string | null
        }
        Update: {
          categoria_id?: string | null
          created_at?: string | null
          hecho?: boolean
          id?: string
          nota?: string | null
          orden?: number
          titulo?: string
          url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pendientes_items_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "pendientes_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          avatar_url: string | null
          descripcion: string | null
          email: string | null
          id: string
          mascota_id: string | null
          monedas: number
          nivel: number
          personaje_favorito_id: string | null
          rol: string | null
          status: string | null
          titulo: string | null
          username: string | null
          xp_total: number
        }
        Insert: {
          avatar_url?: string | null
          descripcion?: string | null
          email?: string | null
          id: string
          mascota_id?: string | null
          monedas?: number
          nivel?: number
          personaje_favorito_id?: string | null
          rol?: string | null
          status?: string | null
          titulo?: string | null
          username?: string | null
          xp_total?: number
        }
        Update: {
          avatar_url?: string | null
          descripcion?: string | null
          email?: string | null
          id?: string
          mascota_id?: string | null
          monedas?: number
          nivel?: number
          personaje_favorito_id?: string | null
          rol?: string | null
          status?: string | null
          titulo?: string | null
          username?: string | null
          xp_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_mascota_id_fkey"
            columns: ["mascota_id"]
            isOneToOne: false
            referencedRelation: "criaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfiles_personaje_favorito_id_fkey"
            columns: ["personaje_favorito_id"]
            isOneToOne: false
            referencedRelation: "personajes"
            referencedColumns: ["id"]
          },
        ]
      }
      personaje_dones: {
        Row: {
          don_id: string
          id: string
          personaje_id: string
        }
        Insert: {
          don_id: string
          id?: string
          personaje_id: string
        }
        Update: {
          don_id?: string
          id?: string
          personaje_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personaje_dones_don_id_fkey"
            columns: ["don_id"]
            isOneToOne: false
            referencedRelation: "dones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personaje_dones_personaje_id_fkey"
            columns: ["personaje_id"]
            isOneToOne: false
            referencedRelation: "personajes"
            referencedColumns: ["id"]
          },
        ]
      }
      personaje_eras: {
        Row: {
          created_at: string | null
          id: string
          label: string | null
          momento: number
          notas: string | null
          personaje_id: string
          rasgos: string[]
        }
        Insert: {
          created_at?: string | null
          id?: string
          label?: string | null
          momento: number
          notas?: string | null
          personaje_id: string
          rasgos?: string[]
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string | null
          momento?: number
          notas?: string | null
          personaje_id?: string
          rasgos?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "personaje_eras_personaje_id_fkey"
            columns: ["personaje_id"]
            isOneToOne: false
            referencedRelation: "personajes"
            referencedColumns: ["id"]
          },
        ]
      }
      personaje_hechizos: {
        Row: {
          hechizo_id: string
          id: string
          personaje_id: string
        }
        Insert: {
          hechizo_id: string
          id?: string
          personaje_id: string
        }
        Update: {
          hechizo_id?: string
          id?: string
          personaje_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personaje_hechizos_hechizo_id_fkey"
            columns: ["hechizo_id"]
            isOneToOne: false
            referencedRelation: "hechizos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personaje_hechizos_personaje_id_fkey"
            columns: ["personaje_id"]
            isOneToOne: false
            referencedRelation: "personajes"
            referencedColumns: ["id"]
          },
        ]
      }
      personajes: {
        Row: {
          caracteristicas: string | null
          ciudad_id: string | null
          don: string | null
          especie: string | null
          fecha_nacimiento: number | null
          id: string
          img_cuerpo_url: string | null
          img_url: string | null
          lugar_id: string | null
          nombre: string
          reino: string | null
          sobre: string | null
          updated_at: string
          variante_id: string | null
        }
        Insert: {
          caracteristicas?: string | null
          ciudad_id?: string | null
          don?: string | null
          especie?: string | null
          fecha_nacimiento?: number | null
          id?: string
          img_cuerpo_url?: string | null
          img_url?: string | null
          lugar_id?: string | null
          nombre: string
          reino?: string | null
          sobre?: string | null
          updated_at?: string
          variante_id?: string | null
        }
        Update: {
          caracteristicas?: string | null
          ciudad_id?: string | null
          don?: string | null
          especie?: string | null
          fecha_nacimiento?: number | null
          id?: string
          img_cuerpo_url?: string | null
          img_url?: string | null
          lugar_id?: string | null
          nombre?: string
          reino?: string | null
          sobre?: string | null
          updated_at?: string
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personajes_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personajes_lugar_id_fkey"
            columns: ["lugar_id"]
            isOneToOne: false
            referencedRelation: "lugares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personajes_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "criatura_variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_diario_registro: {
        Row: {
          dias: boolean[]
          semana: string
          tipo: string
        }
        Insert: {
          dias?: boolean[]
          semana: string
          tipo: string
        }
        Update: {
          dias?: boolean[]
          semana?: string
          tipo?: string
        }
        Relationships: []
      }
      planta_ciudades: {
        Row: {
          ciudad_id: string
          id: string
          planta_id: string
        }
        Insert: {
          ciudad_id: string
          id?: string
          planta_id: string
        }
        Update: {
          ciudad_id?: string
          id?: string
          planta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planta_ciudades_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planta_ciudades_planta_id_fkey"
            columns: ["planta_id"]
            isOneToOne: false
            referencedRelation: "plantas"
            referencedColumns: ["id"]
          },
        ]
      }
      planta_lugares: {
        Row: {
          id: string
          lugar_id: string | null
          planta_id: string | null
        }
        Insert: {
          id?: string
          lugar_id?: string | null
          planta_id?: string | null
        }
        Update: {
          id?: string
          lugar_id?: string | null
          planta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planta_lugares_lugar_id_fkey"
            columns: ["lugar_id"]
            isOneToOne: false
            referencedRelation: "lugares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planta_lugares_planta_id_fkey"
            columns: ["planta_id"]
            isOneToOne: false
            referencedRelation: "plantas"
            referencedColumns: ["id"]
          },
        ]
      }
      plantas: {
        Row: {
          categoria: string | null
          created_at: string
          descripcion: string | null
          id: string
          imagen_url: string | null
          nombre: string
          reino_ids: string[]
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          reino_ids?: string[]
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          reino_ids?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      precios: {
        Row: {
          created_at: string
          id: string
          ingrediente_id: string | null
          monto_pagado: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ingrediente_id?: string | null
          monto_pagado: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ingrediente_id?: string | null
          monto_pagado?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "precios_ingrediente_id_fkey"
            columns: ["ingrediente_id"]
            isOneToOne: false
            referencedRelation: "ingredientes"
            referencedColumns: ["id"]
          },
        ]
      }
      recetas: {
        Row: {
          autor_id: string | null
          categoria: string | null
          created_at: string | null
          descripcion: string | null
          dificultad: string | null
          id: string
          imagen_url: string | null
          ingredientes: Json | null
          instrucciones: Json | null
          nombre: string
          tiempo: string | null
        }
        Insert: {
          autor_id?: string | null
          categoria?: string | null
          created_at?: string | null
          descripcion?: string | null
          dificultad?: string | null
          id?: string
          imagen_url?: string | null
          ingredientes?: Json | null
          instrucciones?: Json | null
          nombre: string
          tiempo?: string | null
        }
        Update: {
          autor_id?: string | null
          categoria?: string | null
          created_at?: string | null
          descripcion?: string | null
          dificultad?: string | null
          id?: string
          imagen_url?: string | null
          ingredientes?: Json | null
          instrucciones?: Json | null
          nombre?: string
          tiempo?: string | null
        }
        Relationships: []
      }
      reino_tiles: {
        Row: {
          col: number
          created_at: string
          id: string
          image_url: string | null
          label: string | null
          order: number
          reino_id: string
          row: number
          updated_at: string
        }
        Insert: {
          col: number
          created_at?: string
          id?: string
          image_url?: string | null
          label?: string | null
          order?: number
          reino_id: string
          row: number
          updated_at?: string
        }
        Update: {
          col?: number
          created_at?: string
          id?: string
          image_url?: string | null
          label?: string | null
          order?: number
          reino_id?: string
          row?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reino_tiles_reino_id_fkey"
            columns: ["reino_id"]
            isOneToOne: false
            referencedRelation: "reinos"
            referencedColumns: ["id"]
          },
        ]
      }
      reinos: {
        Row: {
          coord_x: number | null
          coord_y: number | null
          cultura: string | null
          descripcion: string | null
          economia: string | null
          fondo_color: string | null
          geografia: string | null
          id: string
          logo_url: string | null
          mapa_url: string | null
          nombre: string
          orden: number | null
          politica: string | null
          updated_at: string
        }
        Insert: {
          coord_x?: number | null
          coord_y?: number | null
          cultura?: string | null
          descripcion?: string | null
          economia?: string | null
          fondo_color?: string | null
          geografia?: string | null
          id?: string
          logo_url?: string | null
          mapa_url?: string | null
          nombre: string
          orden?: number | null
          politica?: string | null
          updated_at?: string
        }
        Update: {
          coord_x?: number | null
          coord_y?: number | null
          cultura?: string | null
          descripcion?: string | null
          economia?: string | null
          fondo_color?: string | null
          geografia?: string | null
          id?: string
          logo_url?: string | null
          mapa_url?: string | null
          nombre?: string
          orden?: number | null
          politica?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      relaciones: {
        Row: {
          created_at: string | null
          id: string
          nota: string | null
          personaje_id: string
          personaje_rel_id: string
          tipo: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nota?: string | null
          personaje_id: string
          personaje_rel_id: string
          tipo: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nota?: string | null
          personaje_id?: string
          personaje_rel_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "relaciones_personaje_id_fkey"
            columns: ["personaje_id"]
            isOneToOne: false
            referencedRelation: "personajes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relaciones_personaje_rel_id_fkey"
            columns: ["personaje_rel_id"]
            isOneToOne: false
            referencedRelation: "personajes"
            referencedColumns: ["id"]
          },
        ]
      }
      ropa: {
        Row: {
          categoria: string | null
          color: string | null
          colores: string[] | null
          created_at: string
          descripcion: string | null
          id: string
          imagen_url: string | null
          nombre: string
          temporadas: string[] | null
          user_id: string | null
          username: string | null
          vibras: string[] | null
        }
        Insert: {
          categoria?: string | null
          color?: string | null
          colores?: string[] | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre: string
          temporadas?: string[] | null
          user_id?: string | null
          username?: string | null
          vibras?: string[] | null
        }
        Update: {
          categoria?: string | null
          color?: string | null
          colores?: string[] | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          temporadas?: string[] | null
          user_id?: string | null
          username?: string | null
          vibras?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "ropa_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ropa_outfits: {
        Row: {
          created_at: string
          id: string
          nombre_look: string
          prendas_ids: string[]
          user_id: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nombre_look: string
          prendas_ids: string[]
          user_id?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nombre_look?: string
          prendas_ids?: string[]
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ropa_outfits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      runas: {
        Row: {
          created_at: string
          criatura_id: string | null
          explicacion: string | null
          id: string
          imagen_url: string | null
          nombre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criatura_id?: string | null
          explicacion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criatura_id?: string | null
          explicacion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "runas_criatura_id_fkey"
            columns: ["criatura_id"]
            isOneToOne: false
            referencedRelation: "criaturas"
            referencedColumns: ["id"]
          },
        ]
      }
      rutinas: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          tag: string | null
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          tag?: string | null
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          tag?: string | null
        }
        Relationships: []
      }
      secciones_cancion: {
        Row: {
          cancion_id: string | null
          created_at: string | null
          id: string
          letra_en: string | null
          letra_es: string | null
          letra_jp: string | null
          letra_romaji: string | null
          nombre_seccion: string
          orden: number
          timings_en: Json | null
          timings_es: Json | null
          timings_jp: Json | null
          timings_romaji: Json | null
          updated_at: string | null
        }
        Insert: {
          cancion_id?: string | null
          created_at?: string | null
          id?: string
          letra_en?: string | null
          letra_es?: string | null
          letra_jp?: string | null
          letra_romaji?: string | null
          nombre_seccion: string
          orden: number
          timings_en?: Json | null
          timings_es?: Json | null
          timings_jp?: Json | null
          timings_romaji?: Json | null
          updated_at?: string | null
        }
        Update: {
          cancion_id?: string | null
          created_at?: string | null
          id?: string
          letra_en?: string | null
          letra_es?: string | null
          letra_jp?: string | null
          letra_romaji?: string | null
          nombre_seccion?: string
          orden?: number
          timings_en?: Json | null
          timings_es?: Json | null
          timings_jp?: Json | null
          timings_romaji?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "secciones_cancion_cancion_id_fkey"
            columns: ["cancion_id"]
            isOneToOne: false
            referencedRelation: "canciones"
            referencedColumns: ["id"]
          },
        ]
      }
      suscriptores: {
        Row: {
          created_at: string | null
          email: string | null
          endpoint: string | null
          id: number
          subscription_data: Json | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          endpoint?: string | null
          id?: number
          subscription_data?: Json | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          endpoint?: string | null
          id?: number
          subscription_data?: Json | null
        }
        Relationships: []
      }
      tareas: {
        Row: {
          categoria: string | null
          completada: boolean | null
          created_at: string
          id: string
          titulo: string
          username: string | null
        }
        Insert: {
          categoria?: string | null
          completada?: boolean | null
          created_at?: string
          id?: string
          titulo: string
          username?: string | null
        }
        Update: {
          categoria?: string | null
          completada?: boolean | null
          created_at?: string
          id?: string
          titulo?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tareas_username_fkey"
            columns: ["username"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["username"]
          },
        ]
      }
      wiki_notifications: {
        Row: {
          has_new_content: boolean | null
          id: string
          page_name: string
          updated_at: string | null
        }
        Insert: {
          has_new_content?: boolean | null
          id?: string
          page_name: string
          updated_at?: string | null
        }
        Update: {
          has_new_content?: boolean | null
          id?: string
          page_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      libros_con_reino: {
        Row: {
          created_at: string | null
          estado: string | null
          fecha_proximo_capitulo: string | null
          fecha_publicacion: string | null
          id: string | null
          portada_url: string | null
          reino_id: string | null
          reino_nombre: string | null
          sinopsis: string | null
          titulo: string | null
          visibilidad: string | null
        }
        Relationships: [
          {
            foreignKeyName: "libros_reino_id_fkey"
            columns: ["reino_id"]
            isOneToOne: false
            referencedRelation: "reinos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      es_admin: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      reclamar_mision: {
        Args: { p_mision_id: string }
        Returns: {
          monedas: number
          xp_total: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
