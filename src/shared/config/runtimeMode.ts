/**
 * Runtime mode configuration.
 *
 * Modes:
 *   dev-mock        – fully mocked, no hardware/cloud required
 *   dev-cpu         – local CPU inference (Whisper, TTS, etc.)
 *   prod-cloud-gpu  – production with cloud GPU back-end
 */

export type RuntimeMode = 'dev-mock' | 'dev-cpu' | 'prod-cloud-gpu'

/** Read from VITE_APP_RUNTIME_MODE (injected at build time via .env files). */
export const runtimeMode: RuntimeMode =
  (import.meta.env.VITE_APP_RUNTIME_MODE as RuntimeMode) || 'dev-mock'

export const isMock = runtimeMode === 'dev-mock'
export const isCpu = runtimeMode === 'dev-cpu'
export const isCloudGpu = runtimeMode === 'prod-cloud-gpu'
