/**
 * LEARNING NOTE: Environment Reflections (Babylon.js)
 *
 * Babylon.js handles environment reflections automatically when you set
 * scene.environmentTexture. For now we skip the cubemap (Babylon's
 * built-in lighting provides adequate reflections). This file is kept
 * as a placeholder for future HDR environment map loading.
 *
 * Key concepts: environment mapping, IBL
 */

// Placeholder — Babylon.js handles reflections via scene.environmentTexture
// which can be loaded from .env or .hdr files in the future.
// For now, the PBR materials reflect the scene lights directly.

export function setupEnvironment(): void {
  // No-op for now. Scene lights provide adequate reflections.
  // Future: load an HDR environment with CubeTexture.CreateFromPrefilteredData()
}
