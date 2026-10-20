/**
 * Resolves when the network layer can serve requests (immediately in
 * production; after the MSW worker is active when mocks are enabled). The UI
 * renders right away (skeletons) and requests wait for this instead of the
 * whole app waiting before its first paint.
 */
let resolveReady!: () => void
export const networkReady = new Promise<void>((r) => (resolveReady = r))
export const markNetworkReady = () => resolveReady()
