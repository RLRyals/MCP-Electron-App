#!/bin/bash
ELECTRON=node_modules/electron/dist/electron.exe
for v in "" "--disable-gpu" "--use-angle=swiftshader --enable-unsafe-swiftshader" "--no-sandbox" "--disable-gpu-process-crash-limit"; do
  echo "=== MINI VARIANT: [$v]"
  ELECTRON_ENABLE_LOGGING=1 timeout 40 $ELECTRON e2e/probe-mini $v 2>&1 | grep -E "ALIVE|GONE|FATAL|crash" | head -6 || true
done
for v in "--disable-gpu-process-crash-limit" "--no-sandbox" "--disable-gpu --disable-gpu-process-crash-limit" "--use-angle=gl" "--use-angle=d3d9" "--disable-features=DirectComposition,UseSkiaRenderer" "--disable-accelerated-2d-canvas --disable-gpu-rasterization --disable-zero-copy"; do
  echo "=== APP VARIANT: [$v]"
  E2E_EXTRA_ARGS="$v" npx playwright test e2e/smoke.spec.ts 2>&1 | grep -E "^\s+(ok|x)\s+[0-9]|passed|failed|FATAL" | head -8 || true
done
