import { getActiveRunNames } from '../workflow/active-run-guard';

describe('getActiveRunNames (mea-3ow)', () => {
  it('lists active runs, skipping terminal ones', async () => {
    const names = await getActiveRunNames(async () => [
      { workflow_name: 'Chapter draft', status: 'running' },
      { workflow_name: 'Old', status: 'completed' },
    ]);
    expect(names).toEqual(['Chapter draft']);
  });
  it('none active -> []', async () => {
    expect(await getActiveRunNames(async () => [])).toEqual([]);
  });
  it('pluginless / failure -> [] without throwing', async () => {
    expect(await getActiveRunNames(async () => { throw new Error('no plugin'); })).toEqual([]);
  });
});
