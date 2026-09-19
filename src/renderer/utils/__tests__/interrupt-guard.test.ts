import { confirmProceedWithActiveWorkflows } from '../interrupt-guard';

function setInvoke(fn: jest.Mock) {
  (window as any).electronAPI = { invoke: fn };
}
afterEach(() => { document.body.innerHTML = ''; });

it('warns listing runs; Wait (default) resolves false', async () => {
  setInvoke(jest.fn().mockResolvedValue(['Chapter draft']));
  const p = confirmProceedWithActiveWorkflows('Restarting');
  await Promise.resolve(); await Promise.resolve();
  expect(document.body.textContent).toContain('Chapter draft');
  (document.getElementById('active-workflow-wait') as HTMLElement).click();
  expect(await p).toBe(false);
});

it('Restart anyway resolves true', async () => {
  setInvoke(jest.fn().mockResolvedValue(['X']));
  const p = confirmProceedWithActiveWorkflows('Restarting');
  await Promise.resolve(); await Promise.resolve();
  (document.getElementById('active-workflow-anyway') as HTMLElement).click();
  expect(await p).toBe(true);
});

it('none active -> proceeds with no dialog', async () => {
  setInvoke(jest.fn().mockResolvedValue([]));
  expect(await confirmProceedWithActiveWorkflows('Restarting')).toBe(true);
  expect(document.getElementById('active-workflow-warning')).toBeNull();
});

it('pluginless (invoke rejects) -> proceeds', async () => {
  setInvoke(jest.fn().mockRejectedValue(new Error('No handler')));
  expect(await confirmProceedWithActiveWorkflows('Restarting')).toBe(true);
});
