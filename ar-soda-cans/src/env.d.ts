/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** how many cans MindAR tracks/overlays at once; see .env.example. Default 1. */
  readonly VITE_MAX_TRACK?: string
  /** URL MindAR loads compiled tracking data from. Default '/targets.mind'. */
  readonly VITE_TARGETS_SRC?: string
}
