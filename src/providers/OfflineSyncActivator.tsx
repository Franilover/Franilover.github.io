"use client";

import { useOfflineSync } from "@/infra/sync/useOfflineSync";

export function OfflineSyncActivator() {
  useOfflineSync();
  
  return null;
}