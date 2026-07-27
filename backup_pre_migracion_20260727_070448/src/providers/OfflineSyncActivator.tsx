"use client";

import { useOfflineSync } from "@/hooks/data/useOfflineSync";

export function OfflineSyncActivator() {
  useOfflineSync();
  
  return null;
}