/**
 * mea-gg9: licensed (private) skills must never be exported.
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

jest.mock('../../logger', () => ({
  logWithCategory: jest.fn(),
  LogCategory: { WORKFLOW: 'workflow' }
}));

import { ClaudeCodeExporter } from '../exporters/claude-code-exporter';

describe('ClaudeCodeExporter private skills (mea-gg9)', () => {
  let tmp: string;
  let exporter: any;
  const workflows: Record<string, any> = {};

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mea-gg9-'));
    const skillsDir = path.join(tmp, 'skills');
    await fs.outputFile(path.join(skillsDir, 'pub-skill', 'SKILL.md'), '---\nname: pub-skill\n---\nPUBLIC BODY');
    await fs.outputFile(path.join(skillsDir, 'secret-skill', 'SKILL.md'), '---\nname: secret-skill\nprivate: true\nlicense: Fiction.show\n---\nSECRET BODY');
    await fs.outputFile(path.join(skillsDir, 'secret-sub.md'), '---\nprivate: true\n---\nSECRET SUB BODY');

    exporter = new ClaudeCodeExporter();
    exporter.skillsPath = skillsDir;
    exporter.agentsPath = path.join(tmp, 'agents');
    exporter.outputStylesPath = path.join(tmp, 'output-styles');

    workflows.main = {
      id: 'main', name: 'Main', version: '1.0.0',
      graph_json: { nodes: [
        { id: 'a', name: 'A', type: 'planning', skill: 'pub-skill' },
        { id: 'b', name: 'B', type: 'planning', skill: 'secret-skill' },
        { id: 'c', name: 'C', type: 'subworkflow', subWorkflowId: 'sub' }
      ], edges: [] },
      dependencies_json: { agents: [], skills: [], mcpServers: [], subWorkflows: [] }
    };
    workflows.sub = {
      id: 'sub', name: 'Sub', version: '1.0.0',
      graph_json: { nodes: [{ id: 'd', name: 'D', type: 'planning', skill: 'secret-sub' }], edges: [] },
      dependencies_json: { agents: [], skills: [], mcpServers: [], subWorkflows: [] }
    };
    exporter.workflowClient = {
      getWorkflowDefinition: jest.fn(async (id: string) => workflows[id])
    };
  });

  afterEach(async () => {
    await fs.remove(tmp);
  });

  it('partitions private skills from shareable ones', async () => {
    const r = await exporter.partitionPrivateSkills(['pub-skill', 'secret-skill', 'secret-sub', 'missing']);
    expect(r.privateSkills.sort()).toEqual(['secret-skill', 'secret-sub']);
    expect(r.shareable.sort()).toEqual(['missing', 'pub-skill']);
  });

  it('copies only shareable skills and lists private ones as requires in the README', async () => {
    const { shareable, privateSkills } = await exporter.partitionPrivateSkills(['pub-skill', 'secret-skill', 'secret-sub']);
    const out = path.join(tmp, 'out');
    await fs.ensureDir(out);
    await exporter.copySkills(shareable, out);
    await exporter.generateReadme(workflows.main, [], shareable, [], [], out, privateSkills);

    expect(await fs.pathExists(path.join(out, 'skills', 'pub-skill', 'SKILL.md'))).toBe(true);
    expect(await fs.pathExists(path.join(out, 'skills', 'secret-skill'))).toBe(false);
    expect(await fs.pathExists(path.join(out, 'skills', 'secret-sub.md'))).toBe(false);

    const readme = await fs.readFile(path.join(out, 'README.md'), 'utf-8');
    expect(readme).toContain('requires: secret-skill -- install it yourself');
    expect(readme).toContain('requires: secret-sub -- install it yourself');
    expect(readme).not.toContain('SECRET');
  });

  it('full export (incl. sub-workflow reference) leaks no private skill content', async () => {
    const out = path.join(tmp, 'full');
    const result = await exporter.export('main', { outputPath: out });
    expect(result.success).toBe(true);

    const files: string[] = [];
    const walk = async (d: string) => {
      for (const e of await fs.readdir(d)) {
        const p = path.join(d, e);
        if ((await fs.stat(p)).isDirectory()) { await walk(p); } else { files.push(p); }
      }
    };
    await walk(out);
    for (const f of files) {
      expect(await fs.readFile(f, 'utf-8')).not.toMatch(/SECRET/);
    }
    expect(files.some(f => f.includes('secret'))).toBe(false);
    expect(files.some(f => f.includes('pub-skill'))).toBe(true);
    const readme = await fs.readFile(path.join(out, 'README.md'), 'utf-8');
    expect(readme).toContain('requires: secret-sub');
  });
});
