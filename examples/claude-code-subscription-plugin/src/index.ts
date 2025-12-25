/**
 * Claude Code Subscription Plugin
 *
 * Installs Claude Code CLI and authenticates with Anthropic subscription
 * Provides headless execution with form-based interaction
 */

import type { PluginContext } from '../../../src/types/plugin-api';
import { ClaudeCodePlugin } from './ClaudeCodePlugin';

// Create single plugin instance
const pluginInstance = new ClaudeCodePlugin();

// Export plugin with metadata and lifecycle methods
export default {
  id: 'claude-code-subscription',
  name: 'Claude Code (Subscription)',
  version: '1.0.0',

  async onActivate(context: PluginContext): Promise<void> {
    await pluginInstance.onActivate(context);
  },

  async onDeactivate(): Promise<void> {
    await pluginInstance.onDeactivate();
  },
};
