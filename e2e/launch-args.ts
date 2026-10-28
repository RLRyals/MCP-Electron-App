/**
 * Extra Electron command-line switches for every e2e launch (mea-3ya).
 *
 * The windows-2025-vs2026 GitHub runner has no usable GPU. Chromium's GPU
 * process there dies with 0xC0000005 (exit_code=-1073741819) over and over;
 * after the 9th crash Chromium logs "FATAL: GPU process isn't usable. Goodbye."
 * and the whole app exits, so Playwright's firstWindow() reports "Target page,
 * context or browser has been closed" for every spec. These tests check
 * renderer/IPC behaviour, not GPU rendering, so run them on the software path.
 * This does not change what is asserted, only how Chromium composites.
 */
export const E2E_GPU_ARGS: string[] = ['--disable-gpu', '--disable-gpu-compositing', '--disable-software-rasterizer'];
