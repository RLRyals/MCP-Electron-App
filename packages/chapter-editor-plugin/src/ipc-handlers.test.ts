import { registerIPCHandlers } from './ipc-handlers';
import { PluginContext } from '../../../src/types/plugin-api';

function createMockContext(overrides: Partial<Record<string, jest.Mock>> = {}) {
  const handlers = new Map<string, (event: any, args?: any) => Promise<any>>();

  const fileSystem = {
    readFile: overrides.readFile ?? jest.fn(),
    writeFile: overrides.writeFile ?? jest.fn(),
    exists: overrides.exists ?? jest.fn(),
    mkdir: jest.fn(),
    readdir: jest.fn(),
    delete: jest.fn(),
    stat: jest.fn(),
  };

  const context = {
    services: { fileSystem },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    ipc: {
      handle: (channel: string, handler: any) => handlers.set(channel, handler),
      send: jest.fn(),
      removeHandler: jest.fn(),
      getChannelName: (channel: string) => `plugin:fictionlab-chapter-editor:${channel}`,
    },
  } as unknown as PluginContext;

  return { context, handlers, fileSystem };
}

describe('registerIPCHandlers', () => {
  it('registers the four chapter-editor channels', () => {
    const { context, handlers } = createMockContext();
    const registered = registerIPCHandlers(context);

    expect(registered).toEqual([
      'chapter-editor:read-chapter',
      'chapter-editor:write-chapter',
      'chapter-editor:read-comments',
      'chapter-editor:write-comments',
    ]);
    expect(Array.from(handlers.keys())).toEqual(registered);
  });

  describe('chapter-editor:read-chapter', () => {
    it('reads the file and returns its content', async () => {
      const readFile = jest.fn().mockResolvedValue('# Chapter One');
      const { context, handlers } = createMockContext({ readFile });
      registerIPCHandlers(context);

      const result = await handlers.get('chapter-editor:read-chapter')!({}, { filePath: 'C:/book/ch1.md' });

      expect(readFile).toHaveBeenCalledWith('C:/book/ch1.md');
      expect(result).toEqual({ content: '# Chapter One' });
    });

    it('rejects a non-markdown path', async () => {
      const { context, handlers } = createMockContext();
      registerIPCHandlers(context);

      await expect(handlers.get('chapter-editor:read-chapter')!({}, { filePath: 'C:/book/ch1.txt' })).rejects.toThrow(
        'A .md/.markdown filePath is required'
      );
    });
  });

  describe('chapter-editor:write-chapter', () => {
    it('writes the given content to the file', async () => {
      const writeFile = jest.fn().mockResolvedValue(undefined);
      const { context, handlers } = createMockContext({ writeFile });
      registerIPCHandlers(context);

      const result = await handlers.get('chapter-editor:write-chapter')!(
        {},
        { filePath: 'C:/book/ch1.md', content: 'Once upon a time.' }
      );

      expect(writeFile).toHaveBeenCalledWith('C:/book/ch1.md', 'Once upon a time.');
      expect(result).toEqual({ success: true });
    });
  });

  describe('chapter-editor:read-comments', () => {
    it('returns [] when no sidecar file exists', async () => {
      const exists = jest.fn().mockResolvedValue(false);
      const { context, handlers } = createMockContext({ exists });
      registerIPCHandlers(context);

      const result = await handlers.get('chapter-editor:read-comments')!({}, { filePath: 'C:/book/ch1.md' });

      expect(exists).toHaveBeenCalledWith('C:/book/ch1.md.comments.json');
      expect(result).toEqual([]);
    });

    it('parses the sidecar file when present', async () => {
      const exists = jest.fn().mockResolvedValue(true);
      const comments = [{ id: 'a1', anchorText: 'foo', commentText: 'bar', createdAt: '2026-07-22T00:00:00.000Z' }];
      const readFile = jest.fn().mockResolvedValue(JSON.stringify(comments));
      const { context, handlers } = createMockContext({ exists, readFile });
      registerIPCHandlers(context);

      const result = await handlers.get('chapter-editor:read-comments')!({}, { filePath: 'C:/book/ch1.md' });

      expect(result).toEqual(comments);
    });

    it('fails soft (returns []) when the sidecar is corrupt', async () => {
      const exists = jest.fn().mockResolvedValue(true);
      const readFile = jest.fn().mockResolvedValue('not json');
      const { context, handlers } = createMockContext({ exists, readFile });
      registerIPCHandlers(context);

      const result = await handlers.get('chapter-editor:read-comments')!({}, { filePath: 'C:/book/ch1.md' });

      expect(result).toEqual([]);
    });
  });

  describe('chapter-editor:write-comments', () => {
    it('serializes comments to the sidecar path', async () => {
      const writeFile = jest.fn().mockResolvedValue(undefined);
      const { context, handlers } = createMockContext({ writeFile });
      registerIPCHandlers(context);

      const comments = [{ id: 'a1', anchorText: 'foo', commentText: 'bar', createdAt: '2026-07-22T00:00:00.000Z' }];
      const result = await handlers.get('chapter-editor:write-comments')!({}, { filePath: 'C:/book/ch1.md', comments });

      expect(writeFile).toHaveBeenCalledWith('C:/book/ch1.md.comments.json', JSON.stringify(comments, null, 2));
      expect(result).toEqual({ success: true });
    });
  });
});
