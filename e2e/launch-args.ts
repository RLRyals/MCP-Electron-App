/**
 * Extra Electron command-line switches for every e2e launch (mea-3ya).
 */
const extra = (process.env.E2E_EXTRA_ARGS || '').split(' ').filter(Boolean);
export const E2E_GPU_ARGS: string[] = [...extra];
