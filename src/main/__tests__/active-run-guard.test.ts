import { getActiveRunNames, getActiveRunSummary } from '../workflow/active-run-guard';

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

describe('getActiveRunSummary (mea-b5e)', () => {
  it('separates parked runs from running ones', async () => {
    const s = await getActiveRunSummary(async () => [
      { workflow_name: 'Live', status: 'running' },
      { workflow_name: 'Gate', status: 'paused' },
      { workflow_name: 'Gate2', status: 'awaiting_approval' },
      { workflow_name: 'Done', status: 'completed' },
    ]);
    expect(s).toEqual({ running: ['Live'], parked: ['Gate', 'Gate2'] });
  });
  it('failure -> empty summary', async () => {
    expect(await getActiveRunSummary(async () => { throw new Error('x'); })).toEqual({ running: [], parked: [] });
  });
});
