/**
 * Preload script — exposes a minimal, safe API to the renderer.
 * Currently empty (no IPC needed) but kept for future expansion
 * (e.g. file dialogs, native notifications).
 */
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('usjDesktop', {
  version: '1.0.0',
  platform: process.platform,
})
