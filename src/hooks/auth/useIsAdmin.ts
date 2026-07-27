import { useState, useEffect } from 'react';

import { supabase } from "@/infra/supabase/supabase";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;

      const { data: perfil } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", data.session.user.id)
        .single();

      setIsAdmin(perfil?.rol === "admin");
    });
  }, []);

  return isAdmin;
}