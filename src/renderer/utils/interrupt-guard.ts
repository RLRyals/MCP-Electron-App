/**
 * Warn before a restart/update that would interrupt running workflows
 * (bead mea-3ow). Resolves true when it is OK to proceed.
 */
export async function confirmProceedWithActiveWorkflows(action: string): Promise<boolean> {
  let names: string[] = [];
  try {
    const r = await (window.electronAPI as any).invoke('workflow:active-run-names');
    names = Array.isArray(r) ? r : [];
  } catch {
    return true; // pluginless / channel missing: current behaviour
  }
  if (names.length === 0) return true;

  return new Promise<boolean>((resolve) => {
    const dialog = document.createElement('div');
    dialog.className = 'error-dialog';
    dialog.id = 'active-workflow-warning';
    const list = document.createElement('ul');
    names.forEach((n) => {
      const li = document.createElement('li');
      li.textContent = n;
      list.appendChild(li);
    });
    dialog.innerHTML = `
      <div class="error-dialog-backdrop"></div>
      <div class="error-dialog-content">
        <h3>A workflow is running</h3>
        <p>${action} now will interrupt it:</p>
        <div id="active-workflow-list"></div>
        <div class="error-dialog-buttons">
          <button id="active-workflow-wait" class="button primary">Wait until it finishes</button>
          <button id="active-workflow-anyway" class="button">Restart anyway</button>
        </div>
      </div>`;
    dialog.querySelector('#active-workflow-list')!.appendChild(list);
    document.body.appendChild(dialog);
    const done = (v: boolean) => { dialog.remove(); resolve(v); };
    dialog.querySelector('#active-workflow-wait')!.addEventListener('click', () => done(false));
    dialog.querySelector('#active-workflow-anyway')!.addEventListener('click', () => done(true));
    (dialog.querySelector('#active-workflow-wait') as HTMLButtonElement).focus();
  });
}
