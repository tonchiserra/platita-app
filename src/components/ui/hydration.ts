/**
 * Whether the app has finished its first hydration. Components that animate
 * on mount use it to animate only when they appear after a navigation, never
 * over the server-rendered first paint.
 */
const state = { hydrated: false };

export function isHydrated() {
  return state.hydrated;
}

export function markHydrated() {
  state.hydrated = true;
}
