import { FictionLabPlugin, PluginContext } from '../../../src/types/plugin-api';
import { registerIPCHandlers } from './ipc-handlers';

/**
 * fictionlab-chapter-editor plugin entry.
 *
 * Follow-on from research spike fld-7j4: a hand-editing view over chapter
 * markdown files (highlight + comment + cut/paste, Tiptap Core + the MIT
 * @sereneinserenade/tiptap-comment-extension), per the mea-cjl lean-core /
 * plugin-containment ruling -- MCP-Electron-App core ships no chapter view;
 * this plugin is the only place one exists. It reads/writes the same
 * chapter .md files the chapter-writer-7step skill pipeline already
 * produces, so that pipeline keeps working unchanged underneath this view.
 *
 * onActivate registers the `chapter-editor:*` IPC bridge (ipc-handlers.ts)
 * the renderer view calls into. TTS/STT (Listen + selection-anchored
 * speak-a-fix) is an explicit follow-on once this base scaffold ships, not
 * part of this plugin yet.
 */
export default class ChapterEditorPlugin implements FictionLabPlugin {
  readonly id = 'fictionlab-chapter-editor';
  readonly name = 'Chapter Editor';
  readonly version = '0.1.0';

  private context: PluginContext | null = null;
  private registeredChannels: string[] = [];

  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string, ...args: any[]): void {
    if (this.context?.logger) {
      this.context.logger[level](message, ...args);
    } else {
      // eslint-disable-next-line no-console
      console[level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'log'](`[Chapter Editor Plugin] ${message}`, ...args);
    }
  }

  async onActivate(context: PluginContext): Promise<void> {
    this.context = context;
    this.log('info', 'Activating chapter-editor plugin...');

    try {
      this.registeredChannels = registerIPCHandlers(context);
      this.log('info', 'Chapter-editor plugin activated successfully');
    } catch (error: any) {
      this.log('error', 'Failed to activate chapter-editor plugin:', error.message, error.stack);
      throw error;
    }
  }

  async onDeactivate(): Promise<void> {
    this.log('info', 'Deactivating chapter-editor plugin...');

    if (this.context) {
      for (const channel of this.registeredChannels) {
        try {
          this.context.ipc.removeHandler(channel);
        } catch (error: any) {
          this.log('warn', `Failed to remove IPC handler ${channel}:`, error.message);
        }
      }
    }
    this.registeredChannels = [];

    this.context = null;
    this.log('info', 'Chapter-editor plugin deactivated');
  }
}
