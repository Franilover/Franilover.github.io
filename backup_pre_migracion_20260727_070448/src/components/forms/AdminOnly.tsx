"use client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/providers/AuthProvider";

interface Props {
  children: React.ReactNode;
  redirectTo?: string;
}

export const AdminOnly = ({ children, redirectTo = "/personal" }: Props) => {
  
  const { user, perfil, loading } = useAuth() as any;
  const router = useRouter();

  const isAdmin = perfil?.rol === "admin";

  useEffect(() => {
    
    if (!loading && perfil !== null && (!user || !isAdmin)) {
      router.replace(redirectTo);
    }
  }, [loading, user, perfil, isAdmin, router, redirectTo]);

  
  if (loading || perfil === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary/30" size={32} />
      </div>
    );
  }

  
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary/30" size={32} />
      </div>
    );
  }

  return <>{children}</>;
};