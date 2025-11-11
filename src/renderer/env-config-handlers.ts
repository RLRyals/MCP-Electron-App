/**
 * Environment configuration handlers for renderer process
 * This file contains all the functions for handling environment configuration UI
 */

// Import the interfaces we need (these will be in the main renderer.ts)
interface EnvConfig {
  POSTGRES_DB: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_PORT: number;
  MCP_CONNECTOR_PORT: number;
  MCP_AUTH_TOKEN: string;
  TYPING_MIND_PORT: number;
}

/**
 * Current environment configuration
 */
export let currentEnvConfig: EnvConfig | null = null;

/**
 * Load environment configuration
 */
export async function loadEnvConfig(): Promise<void> {
  try {
    currentEnvConfig = await (window as any).electronAPI.envConfig.getConfig();
    const form = document.getElementById('env-config-form') as HTMLFormElement;
    if (!form || !currentEnvConfig) return;

    (form.elements.namedItem('POSTGRES_DB') as HTMLInputElement).value = currentEnvConfig.POSTGRES_DB;
    (form.elements.namedItem('POSTGRES_USER') as HTMLInputElement).value = currentEnvConfig.POSTGRES_USER;
    (form.elements.namedItem('POSTGRES_PASSWORD') as HTMLInputElement).value = currentEnvConfig.POSTGRES_PASSWORD;
    (form.elements.namedItem('POSTGRES_PORT') as HTMLInputElement).value = String(currentEnvConfig.POSTGRES_PORT);
    (form.elements.namedItem('MCP_CONNECTOR_PORT') as HTMLInputElement).value = String(currentEnvConfig.MCP_CONNECTOR_PORT);
    (form.elements.namedItem('TYPING_MIND_PORT') as HTMLInputElement).value = String(currentEnvConfig.TYPING_MIND_PORT);
    (form.elements.namedItem('MCP_AUTH_TOKEN') as HTMLInputElement).value = currentEnvConfig.MCP_AUTH_TOKEN;

    await updatePasswordStrength(currentEnvConfig.POSTGRES_PASSWORD);
    await checkAllPorts();

    const envPath = await (window as any).electronAPI.envConfig.getEnvFilePath();
    const envPathElement = document.getElementById('env-file-path');
    if (envPathElement) {
      envPathElement.textContent = envPath;
    }

    console.log('Environment configuration loaded');
  } catch (error) {
    console.error('Error loading environment configuration:', error);
    (window as any).showNotification('Failed to load environment configuration', 'error');
  }
}

/**
 * Update password strength indicator
 */
export async function updatePasswordStrength(password: string): Promise<void> {
  try {
    const strength = await (window as any).electronAPI.envConfig.calculatePasswordStrength(password);
    const strengthFill = document.getElementById('strength-fill');
    const strengthText = document.getElementById('strength-text');
    if (!strengthFill || !strengthText) return;

    strengthFill.classList.remove('weak', 'medium', 'strong');
    strengthFill.classList.add(strength);
    strengthText.textContent = strength.charAt(0).toUpperCase() + strength.slice(1);
  } catch (error) {
    console.error('Error calculating password strength:', error);
  }
}

/**
 * Check if a port is available and update UI
 */
export async function checkPortAvailability(port: number, indicatorId: string): Promise<void> {
  const indicator = document.getElementById(indicatorId);
  if (!indicator) return;

  try {
    indicator.innerHTML = '<span class="loading">⏳</span>';
    const available = await (window as any).electronAPI.envConfig.checkPort(port);
    indicator.innerHTML = available ? '<span class="available">✓</span>' : '<span class="unavailable">✗</span>';
  } catch (error) {
    console.error(`Error checking port ${port}:`, error);
    indicator.innerHTML = '<span class="unavailable">?</span>';
  }
}

/**
 * Check all ports
 */
export async function checkAllPorts(): Promise<void> {
  const postgresPortInput = document.getElementById('postgres-port') as HTMLInputElement;
  const mcpPortInput = document.getElementById('mcp-connector-port') as HTMLInputElement;
  const typingMindPortInput = document.getElementById('typing-mind-port') as HTMLInputElement;

  // Validate that we have valid input elements with values
  if (!postgresPortInput || !mcpPortInput || !typingMindPortInput) {
    console.error('One or more port input elements not found');
    return;
  }

  const postgresPort = parseInt(postgresPortInput.value, 10);
  const mcpPort = parseInt(mcpPortInput.value, 10);
  const typingMindPort = parseInt(typingMindPortInput.value, 10);

  // Only check ports that have valid values
  const checks: Promise<void>[] = [];
  if (!isNaN(postgresPort)) {
    checks.push(checkPortAvailability(postgresPort, 'postgres-port-indicator'));
  }
  if (!isNaN(mcpPort)) {
    checks.push(checkPortAvailability(mcpPort, 'mcp-connector-port-indicator'));
  }
  if (!isNaN(typingMindPort)) {
    checks.push(checkPortAvailability(typingMindPort, 'typing-mind-port-indicator'));
  }

  if (checks.length > 0) {
    await Promise.all(checks);
  }
}

/**
 * Toggle password visibility
 */
export function togglePasswordVisibility(inputId: string): void {
  const input = document.getElementById(inputId) as HTMLInputElement;
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

/**
 * Regenerate password
 */
export async function regeneratePassword(): Promise<void> {
  try {
    const newPassword = await (window as any).electronAPI.envConfig.generatePassword(16);
    const passwordInput = document.getElementById('postgres-password') as HTMLInputElement;
    if (passwordInput) {
      passwordInput.value = newPassword;
      await updatePasswordStrength(newPassword);
    }
    (window as any).showNotification('New password generated', 'success');
  } catch (error) {
    console.error('Error generating password:', error);
    (window as any).showNotification('Failed to generate password', 'error');
  }
}

/**
 * Regenerate auth token
 */
export async function regenerateToken(): Promise<void> {
  try {
    const newToken = await (window as any).electronAPI.envConfig.generateToken();
    const tokenInput = document.getElementById('mcp-auth-token') as HTMLInputElement;
    if (tokenInput) {
      tokenInput.value = newToken;
    }
    (window as any).showNotification('New auth token generated', 'success');
  } catch (error) {
    console.error('Error generating token:', error);
    (window as any).showNotification('Failed to generate token', 'error');
  }
}

/**
 * Reset to default configuration
 */
export async function resetToDefaults(): Promise<void> {
  try {
    const defaultConfig = await (window as any).electronAPI.envConfig.resetDefaults();
    const form = document.getElementById('env-config-form') as HTMLFormElement;
    if (!form) return;

    (form.elements.namedItem('POSTGRES_DB') as HTMLInputElement).value = defaultConfig.POSTGRES_DB;
    (form.elements.namedItem('POSTGRES_USER') as HTMLInputElement).value = defaultConfig.POSTGRES_USER;
    (form.elements.namedItem('POSTGRES_PASSWORD') as HTMLInputElement).value = defaultConfig.POSTGRES_PASSWORD;
    (form.elements.namedItem('POSTGRES_PORT') as HTMLInputElement).value = String(defaultConfig.POSTGRES_PORT);
    (form.elements.namedItem('MCP_CONNECTOR_PORT') as HTMLInputElement).value = String(defaultConfig.MCP_CONNECTOR_PORT);
    (form.elements.namedItem('TYPING_MIND_PORT') as HTMLInputElement).value = String(defaultConfig.TYPING_MIND_PORT);
    (form.elements.namedItem('MCP_AUTH_TOKEN') as HTMLInputElement).value = defaultConfig.MCP_AUTH_TOKEN;

    await updatePasswordStrength(defaultConfig.POSTGRES_PASSWORD);
    await checkAllPorts();
    (window as any).showNotification('Configuration reset to defaults', 'success');
  } catch (error) {
    console.error('Error resetting to defaults:', error);
    (window as any).showNotification('Failed to reset to defaults', 'error');
  }
}

/**
 * Save environment configuration
 */
export async function saveEnvConfig(event: Event): Promise<void> {
  event.preventDefault();
  const form = document.getElementById('env-config-form') as HTMLFormElement;
  const statusDiv = document.getElementById('config-status');
  const saveButton = document.getElementById('save-config') as HTMLButtonElement;
  if (!form || !statusDiv || !saveButton) return;

  try {
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    const config: EnvConfig = {
      POSTGRES_DB: (form.elements.namedItem('POSTGRES_DB') as HTMLInputElement).value.trim(),
      POSTGRES_USER: (form.elements.namedItem('POSTGRES_USER') as HTMLInputElement).value.trim(),
      POSTGRES_PASSWORD: (form.elements.namedItem('POSTGRES_PASSWORD') as HTMLInputElement).value,
      POSTGRES_PORT: parseInt((form.elements.namedItem('POSTGRES_PORT') as HTMLInputElement).value, 10),
      MCP_CONNECTOR_PORT: parseInt((form.elements.namedItem('MCP_CONNECTOR_PORT') as HTMLInputElement).value, 10),
      TYPING_MIND_PORT: parseInt((form.elements.namedItem('TYPING_MIND_PORT') as HTMLInputElement).value, 10),
      MCP_AUTH_TOKEN: (form.elements.namedItem('MCP_AUTH_TOKEN') as HTMLInputElement).value,
    };

    const validation = await (window as any).electronAPI.envConfig.validateConfig(config);
    if (!validation.valid) {
      statusDiv.textContent = 'Validation failed: ' + validation.errors.join(', ');
      statusDiv.className = 'config-status error show';
      return;
    }

    const result = await (window as any).electronAPI.envConfig.saveConfig(config);
    if (result.success) {
      statusDiv.textContent = `Configuration saved successfully to ${result.path}`;
      statusDiv.className = 'config-status success show';
      currentEnvConfig = config;
      (window as any).showNotification('Configuration saved successfully', 'success');
    } else {
      statusDiv.textContent = `Failed to save configuration: ${result.error}`;
      statusDiv.className = 'config-status error show';
      (window as any).showNotification('Failed to save configuration', 'error');
    }
  } catch (error) {
    console.error('Error saving configuration:', error);
    statusDiv.textContent = 'Error saving configuration';
    statusDiv.className = 'config-status error show';
    (window as any).showNotification('Error saving configuration', 'error');
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Save Configuration';
  }
}

/**
 * Setup environment configuration event listeners
 */
export function setupEnvConfigListeners(): void {
  // Form submission
  const envForm = document.getElementById('env-config-form');
  if (envForm) {
    envForm.addEventListener('submit', saveEnvConfig);
  }

  // Password toggle
  const togglePassword = document.getElementById('toggle-password');
  if (togglePassword) {
    togglePassword.addEventListener('click', () => togglePasswordVisibility('postgres-password'));
  }

  // Token toggle
  const toggleToken = document.getElementById('toggle-token');
  if (toggleToken) {
    toggleToken.addEventListener('click', () => togglePasswordVisibility('mcp-auth-token'));
  }

  // Regenerate password
  const regeneratePasswordBtn = document.getElementById('regenerate-password');
  if (regeneratePasswordBtn) {
    regeneratePasswordBtn.addEventListener('click', regeneratePassword);
  }

  // Regenerate token
  const regenerateTokenBtn = document.getElementById('regenerate-token');
  if (regenerateTokenBtn) {
    regenerateTokenBtn.addEventListener('click', regenerateToken);
  }

  // Reset defaults
  const resetDefaultsBtn = document.getElementById('reset-defaults');
  if (resetDefaultsBtn) {
    resetDefaultsBtn.addEventListener('click', resetToDefaults);
  }

  // Password input - update strength on change
  const passwordInput = document.getElementById('postgres-password') as HTMLInputElement;
  if (passwordInput) {
    passwordInput.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      updatePasswordStrength(target.value);
    });
  }

  // Port inputs - check availability on change
  const portInputs = ['postgres-port', 'mcp-connector-port', 'typing-mind-port'];
  portInputs.forEach(inputId => {
    const input = document.getElementById(inputId) as HTMLInputElement;
    if (input) {
      input.addEventListener('change', async () => {
        const port = parseInt(input.value, 10);
        await checkPortAvailability(port, `${inputId}-indicator`);
      });
    }
  });

  console.log('Environment configuration event listeners set up');
}
