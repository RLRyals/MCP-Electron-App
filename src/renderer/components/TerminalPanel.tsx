/**
 * TerminalPanel Component
 * Real terminal emulator using xterm.js for interactive CLI applications
 *
 * Features:
 * - Full TTY support via node-pty
 * - Runs Claude Code, Ollama, or any CLI tool
 * - Plugin-based terminal providers
 * - Resizable panel
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

export interface TerminalPanelProps {
  height?: number;
  onResize?: (height: number) => void;
}

// Singleton terminal ID - shared across all TerminalPanel instances
const TERMINAL_ID = 'claude-code-terminal';

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  height = 300,
  onResize
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const xtermTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [panelHeight, setPanelHeight] = useState(height);
  const resizeStartY = useRef<number>(0);
  const resizeStartHeight = useRef<number>(0);
  const [characterCounter, setCharacterCounter] = useState<string>('');

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    console.log('[TerminalPanel] Initializing xterm.js terminal');

    // Create xterm instance
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Cascadia Code", "Consolas", "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);

    fitAddon.fit();
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Focus the terminal
    term.focus();

    // Start Claude Code session
    const electronAPI = (window as any).electronAPI;

    term.writeln('\x1b[1;36m╔═══════════════════════════════════════════════════════════════╗\x1b[0m');
    term.writeln('\x1b[1;36m║\x1b[0m              \x1b[1;33mFictionLab Terminal\x1b[0m                          \x1b[1;36m║\x1b[0m');
    term.writeln('\x1b[1;36m╚═══════════════════════════════════════════════════════════════╝\x1b[0m');
    term.writeln('');

    // Check if terminal session already exists
    electronAPI.invoke('terminal:list').then((terminals: string[]) => {
      if (terminals.includes(TERMINAL_ID)) {
        console.log('[TerminalPanel] Reusing existing terminal session');
        term.writeln('\x1b[1;32m✓ Connected to existing Claude Code session\x1b[0m');
        term.writeln('');
      } else {
        term.writeln('\x1b[1;32mStarting Claude Code...\x1b[0m');
        term.writeln('');

        electronAPI.invoke('terminal:create', {
          id: TERMINAL_ID,
          command: 'claude',  // Assumes claude is in PATH
          args: [],
          cols: term.cols,
          rows: term.rows,
        }).then(() => {
          console.log('[TerminalPanel] Claude Code session started');
        }).catch((error: Error) => {
          console.error('[TerminalPanel] Failed to start Claude Code:', error);
          term.writeln('');
          term.writeln(`\x1b[31m✗ Failed to start Claude Code: ${error.message}\x1b[0m`);
          term.writeln('');
          term.writeln('\x1b[33mMake sure Claude Code CLI is installed and in your PATH:\x1b[0m');
          term.writeln('  npm install -g @anthropic-ai/claude-code');
          term.writeln('');
          term.writeln('\x1b[90mAlternatively, you can use a different terminal provider via plugins.\x1b[0m');
          term.writeln('');
        });
      }
    }).catch((error: Error) => {
      console.error('[TerminalPanel] Failed to check terminal list:', error);
    });

    // Track current workflow input request
    let currentInputRequest: {
      requestId: string;
      buffer: string;
      cursorPos: number;
      validation?: {
        minLength?: number;
        maxLength?: number;
      };
    } | null = null;

    // Helper function to update character counter display
    const updateCharacterCounter = () => {
      if (!currentInputRequest || !currentInputRequest.validation) {
        setCharacterCounter('');
        return;
      }

      const { buffer, validation } = currentInputRequest;
      const len = buffer.length;
      const parts: string[] = [];

      if (validation.maxLength !== undefined) {
        const remaining = validation.maxLength - len;
        if (remaining < 0) {
          parts.push(`${len}/${validation.maxLength} chars (${Math.abs(remaining)} over limit!)`);
        } else if (remaining < 50) {
          parts.push(`${len}/${validation.maxLength} chars`);
        } else {
          parts.push(`${len}/${validation.maxLength} chars`);
        }
      } else {
        parts.push(`${len} chars`);
      }

      if (validation.minLength !== undefined && len < validation.minLength) {
        const needed = validation.minLength - len;
        parts.push(`(need ${needed} more)`);
      }

      setCharacterCounter(parts.join(' '));
    };

    // Handle paste events (Ctrl+V) - attach to both terminal element and xterm's textarea
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const text = e.clipboardData?.getData('text');
      if (text) {
        console.log('[TerminalPanel] Paste event:', text);

        if (currentInputRequest) {
          // Insert at cursor position in workflow mode
          const before = currentInputRequest.buffer.substring(0, currentInputRequest.cursorPos);
          const after = currentInputRequest.buffer.substring(currentInputRequest.cursorPos);
          currentInputRequest.buffer = before + text + after;
          currentInputRequest.cursorPos += text.length;

          // Redraw the line
          term.write('\r\x1b[K'); // Clear line
          term.write(currentInputRequest.buffer);
          // Move cursor to correct position
          const backtrack = currentInputRequest.buffer.length - currentInputRequest.cursorPos;
          if (backtrack > 0) {
            term.write('\x1b[' + backtrack + 'D');
          }
          // Update character counter on separate line
          updateCharacterCounter();
        } else {
          // Normal terminal mode - send paste to PTY
          electronAPI.invoke('terminal:input', TERMINAL_ID, text).catch((error: Error) => {
            console.error('[TerminalPanel] Failed to send paste:', error);
          });
        }
      }
    };

    // Attach paste handler to terminal container
    const terminalContainer = terminalRef.current;
    terminalContainer.addEventListener('paste', handlePaste);

    // Also attach to xterm's internal textarea (created after open())
    // Use setTimeout to ensure textarea is in DOM after term.open()
    // Additionally, re-check periodically to handle React re-renders
    const attachTextareaPasteHandler = () => {
      const xtermTextarea = terminalRef.current?.querySelector('textarea') as HTMLTextAreaElement | null;
      if (xtermTextarea && xtermTextarea !== xtermTextareaRef.current) {
        console.log('[TerminalPanel] Attaching paste handler to xterm textarea');

        // Remove old handler if exists
        if (xtermTextareaRef.current) {
          xtermTextareaRef.current.removeEventListener('paste', handlePaste);
        }

        xtermTextarea.addEventListener('paste', handlePaste);
        xtermTextareaRef.current = xtermTextarea;
      }
    };

    // Initial attachment
    setTimeout(attachTextareaPasteHandler, 100);

    // Re-check every 2 seconds to ensure paste handler persists through re-renders
    const pasteHandlerInterval = setInterval(attachTextareaPasteHandler, 2000);

    // Handle terminal input (user typing)
    term.onData((data) => {
      console.log('[TerminalPanel] User input:', data, data.split('').map(c => c.charCodeAt(0)));

      // Check for Ctrl+V (ASCII 22)
      if (data === '\x16') {
        console.log('[TerminalPanel] Ctrl+V detected, attempting clipboard read');
        // Try to read from clipboard using browser API
        if (navigator.clipboard && navigator.clipboard.readText) {
          navigator.clipboard.readText()
            .then((text) => {
              console.log('[TerminalPanel] Clipboard text:', text);
              if (currentInputRequest) {
                // Insert at cursor position in workflow mode
                const before = currentInputRequest.buffer.substring(0, currentInputRequest.cursorPos);
                const after = currentInputRequest.buffer.substring(currentInputRequest.cursorPos);
                currentInputRequest.buffer = before + text + after;
                currentInputRequest.cursorPos += text.length;

                // Redraw the line
                term.write('\r\x1b[K'); // Clear line
                term.write(currentInputRequest.buffer);
                // Move cursor to correct position
                const backtrack = currentInputRequest.buffer.length - currentInputRequest.cursorPos;
                if (backtrack > 0) {
                  term.write('\x1b[' + backtrack + 'D');
                }
                // Update character counter on separate line
                updateCharacterCounter();
              } else {
                // Normal terminal mode - send to PTY
                electronAPI.invoke('terminal:input', TERMINAL_ID, text).catch((error: Error) => {
                  console.error('[TerminalPanel] Failed to send paste:', error);
                });
              }
            })
            .catch((err) => {
              console.error('[TerminalPanel] Failed to read clipboard:', err);
              term.write('\r\n\x1b[33m⚠ Clipboard access denied. Use right-click paste instead.\x1b[0m\r\n');
            });
        }
        return; // Don't process further
      }

      // If we're capturing workflow input, handle it specially
      if (currentInputRequest) {
        // Check for Enter key (carriage return)
        if (data === '\r' || data === '\n') {
          // User pressed Enter - send the buffered input to workflow
          console.log('[TerminalPanel] Submitting workflow input:', currentInputRequest.buffer);
          electronAPI.invoke('workflow:send-user-input', currentInputRequest.requestId, currentInputRequest.buffer)
            .then(() => {
              console.log('[TerminalPanel] Workflow input submitted successfully');
              term.write('\r\n\x1b[32m✓ Input submitted\x1b[0m\r\n');
            }).catch((error: Error) => {
              console.error('[TerminalPanel] Failed to submit workflow input:', error);
              term.write('\r\n\x1b[31m✗ Failed to submit input\x1b[0m\r\n');
            });
          currentInputRequest = null;
          setCharacterCounter(''); // Clear counter
          term.write('\r\n'); // Move to next line
        } else if (data === '\x7f' || data === '\b') {
          // Backspace - delete character before cursor
          if (currentInputRequest.cursorPos > 0) {
            const before = currentInputRequest.buffer.substring(0, currentInputRequest.cursorPos - 1);
            const after = currentInputRequest.buffer.substring(currentInputRequest.cursorPos);
            currentInputRequest.buffer = before + after;
            currentInputRequest.cursorPos--;

            // Redraw from cursor to end
            term.write('\b' + after + ' '); // Move back, write rest, clear extra char
            // Move cursor back to position
            const backtrack = after.length + 1;
            if (backtrack > 0) {
              term.write('\x1b[' + backtrack + 'D');
            }
            // Update character counter on separate line
            updateCharacterCounter();
          }
        } else if (data === '\x1b[C') {
          // Right arrow - move cursor right
          if (currentInputRequest.cursorPos < currentInputRequest.buffer.length) {
            currentInputRequest.cursorPos++;
            term.write('\x1b[C'); // Move cursor right
          }
        } else if (data === '\x1b[D') {
          // Left arrow - move cursor left
          if (currentInputRequest.cursorPos > 0) {
            currentInputRequest.cursorPos--;
            term.write('\x1b[D'); // Move cursor left
          }
        } else if (data === '\x1b[H') {
          // Home key - move to start
          const backtrack = currentInputRequest.cursorPos;
          if (backtrack > 0) {
            term.write('\x1b[' + backtrack + 'D');
          }
          currentInputRequest.cursorPos = 0;
        } else if (data === '\x1b[F') {
          // End key - move to end
          const forward = currentInputRequest.buffer.length - currentInputRequest.cursorPos;
          if (forward > 0) {
            term.write('\x1b[' + forward + 'C');
          }
          currentInputRequest.cursorPos = currentInputRequest.buffer.length;
        } else if (data === '\x7F' || data.charCodeAt(0) === 127) {
          // Delete key - delete character at cursor
          if (currentInputRequest.cursorPos < currentInputRequest.buffer.length) {
            const before = currentInputRequest.buffer.substring(0, currentInputRequest.cursorPos);
            const after = currentInputRequest.buffer.substring(currentInputRequest.cursorPos + 1);
            currentInputRequest.buffer = before + after;

            // Redraw from cursor to end
            term.write(after + ' '); // Write rest, clear extra char
            // Move cursor back to position
            const backtrack = after.length + 1;
            if (backtrack > 0) {
              term.write('\x1b[' + backtrack + 'D');
            }
            // Update character counter on separate line
            updateCharacterCounter();
          }
        } else if (data.charCodeAt(0) >= 32 && data.charCodeAt(0) < 127) {
          // Regular printable character - insert at cursor position
          const before = currentInputRequest.buffer.substring(0, currentInputRequest.cursorPos);
          const after = currentInputRequest.buffer.substring(currentInputRequest.cursorPos);
          currentInputRequest.buffer = before + data + after;
          currentInputRequest.cursorPos++;

          // Write the new character and everything after it
          term.write(data + after);
          // Move cursor back to position (after the inserted char)
          const backtrack = after.length;
          if (backtrack > 0) {
            term.write('\x1b[' + backtrack + 'D');
          }
          // Update character counter on separate line
          updateCharacterCounter();
        }
      } else {
        // Normal terminal mode - send to PTY
        electronAPI.invoke('terminal:input', TERMINAL_ID, data).catch((error: Error) => {
          console.error('[TerminalPanel] Failed to send input:', error);
        });
      }
    });

    // Focus terminal on click
    terminalRef.current.addEventListener('click', () => {
      console.log('[TerminalPanel] Terminal clicked, focusing');
      term.focus();
    });

    // Handle terminal output from PTY
    // Note: preload's on() wrapper strips the event, so first arg is the payload
    const handleData = (payload: { id: string; data: string }) => {
      console.log('[TerminalPanel] Received terminal:data event:', {
        payloadId: payload?.id,
        expectedId: TERMINAL_ID,
        dataLength: payload?.data?.length,
        hasXterm: !!xtermRef.current,
        match: payload?.id === TERMINAL_ID
      });
      if (payload && payload.id === TERMINAL_ID && xtermRef.current) {
        console.log('[TerminalPanel] Writing data to xterm:', payload.data.substring(0, 50));
        xtermRef.current.write(payload.data);
      } else {
        console.warn('[TerminalPanel] Skipping data - ID mismatch or no xterm', {
          hasPayload: !!payload,
          payloadId: payload?.id,
          expectedId: TERMINAL_ID,
          hasXterm: !!xtermRef.current
        });
      }
    };

    const handleExit = (payload: { id: string; exitCode: number }) => {
      if (payload && payload.id === TERMINAL_ID && xtermRef.current) {
        xtermRef.current.writeln('');
        xtermRef.current.writeln(`\x1b[33m✗ Terminal session ended (exit code: ${payload.exitCode})\x1b[0m`);
        xtermRef.current.writeln('');
      }
    };

    const handleError = (payload: { id: string; error: string }) => {
      if (payload && payload.id === TERMINAL_ID && xtermRef.current) {
        xtermRef.current.writeln('');
        xtermRef.current.writeln(`\x1b[31m✗ Terminal error: ${payload.error}\x1b[0m`);
        xtermRef.current.writeln('');
      }
    };

    electronAPI.on('terminal:data', handleData);
    electronAPI.on('terminal:exit', handleExit);
    electronAPI.on('terminal:error', handleError);

    // Handle workflow user input prompts
    const handleWritePrompt = (data: {
      requestId: string;
      prompt: string;
      validation?: { minLength?: number; maxLength?: number };
    }) => {
      console.log('[TerminalPanel] Writing workflow prompt to terminal:', data);
      if (xtermRef.current) {
        xtermRef.current.write(data.prompt);
        currentInputRequest = {
          requestId: data.requestId,
          buffer: '',
          cursorPos: 0,
          validation: data.validation
        };
        // Show initial character counter
        updateCharacterCounter();
      }
    };

    // Handle workflow log messages
    const handleWorkflowLog = (data: { level: string; category: string; message: string }) => {
      if (!xtermRef.current) return;

      const timestamp = new Date().toLocaleTimeString();
      let colorCode = '\x1b[0m'; // default white

      switch (data.level) {
        case 'error':
          colorCode = '\x1b[31m'; // red
          break;
        case 'warn':
          colorCode = '\x1b[33m'; // yellow
          break;
        case 'info':
          colorCode = '\x1b[36m'; // cyan
          break;
        case 'debug':
          colorCode = '\x1b[90m'; // gray
          break;
      }

      const prefix = data.message.startsWith('✓') ? '' :
                    data.message.startsWith('✗') ? '' :
                    data.message.startsWith('⚠') ? '' : '';

      xtermRef.current.write(`\r\n${colorCode}[${timestamp}] ${prefix}${data.message}\x1b[0m`);
    };

    // Handle Claude Code output streaming from workflows
    const handleClaudeCodeStream = (data: { sessionId: string; data: string; stream: 'stdout' | 'stderr' }) => {
      if (!xtermRef.current) return;

      console.log('[TerminalPanel] Received claude-code:stream event:', {
        sessionId: data.sessionId,
        dataLength: data.data?.length,
        stream: data.stream
      });

      // Color stderr differently (yellow for warnings/errors)
      const colorCode = data.stream === 'stderr' ? '\x1b[33m' : '\x1b[0m';
      xtermRef.current.write(`${colorCode}${data.data}\x1b[0m`);
    };

    electronAPI.on('terminal:write-prompt', handleWritePrompt);
    electronAPI.on('workflow:log', handleWorkflowLog);
    electronAPI.on('claude-code:stream', handleClaudeCodeStream);

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        electronAPI.invoke('terminal:resize', TERMINAL_ID, dims.cols, dims.rows);
      }
    });

    resizeObserver.observe(terminalRef.current);

    // Cleanup
    return () => {
      console.log('[TerminalPanel] Cleaning up terminal');

      // Clear the paste handler interval
      clearInterval(pasteHandlerInterval);

      resizeObserver.disconnect();
      electronAPI.off('terminal:data', handleData);
      electronAPI.off('terminal:exit', handleExit);
      electronAPI.off('terminal:error', handleError);
      electronAPI.off('terminal:write-prompt', handleWritePrompt);
      electronAPI.off('workflow:log', handleWorkflowLog);
      electronAPI.off('claude-code:stream', handleClaudeCodeStream);

      // Remove paste event listeners
      if (terminalContainer) {
        terminalContainer.removeEventListener('paste', handlePaste);
      }
      if (xtermTextareaRef.current) {
        xtermTextareaRef.current.removeEventListener('paste', handlePaste);
        xtermTextareaRef.current = null;
      }

      // Don't close the terminal - it's a singleton that persists
      // electronAPI.invoke('terminal:close', TERMINAL_ID);
      term.dispose();
    };
  }, []);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = panelHeight;
  }, [panelHeight]);

  // Handle resize move
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = resizeStartY.current - e.clientY;
      const newHeight = Math.max(100, Math.min(800, resizeStartHeight.current + delta));
      setPanelHeight(newHeight);
      onResize?.(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onResize]);

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      height: `${panelHeight}px`,
      borderTop: '1px solid #e5e7eb',
      backgroundColor: '#1e1e1e',
    },
    resizeHandle: {
      height: '4px',
      backgroundColor: isResizing ? '#0ea5e9' : '#374151',
      cursor: 'ns-resize',
      transition: 'background-color 0.15s',
    },
    header: {
      padding: '8px 12px',
      backgroundColor: '#252526',
      borderBottom: '1px solid #3e3e42',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontWeight: 600,
      fontSize: '12px',
      color: '#cccccc',
    },
    hint: {
      fontSize: '11px',
      color: '#858585',
    },
    terminal: {
      flex: 1,
      padding: '4px',
      overflow: 'hidden',
    },
  };

  return (
    <div style={styles.container}>
      <div
        style={styles.resizeHandle}
        onMouseDown={handleResizeStart}
      />
      <div style={styles.header}>
        <span style={styles.title}>CLAUDE CODE TERMINAL</span>
        <span style={styles.hint}>
          {characterCounter || 'Interactive terminal powered by xterm.js'}
        </span>
      </div>
      <div ref={terminalRef} style={styles.terminal} />
    </div>
  );
};
