/**
 * Plugin Install Wizard
 *
 * A guided wizard for installing plugins in FictionLab.
 * Supports multiple installation methods:
 * - Import from local folder
 * - Install from URL
 * - Install from marketplace (future)
 */

export interface PluginInstallOptions {
  onComplete?: (success: boolean, pluginId?: string) => void;
  onCancel?: () => void;
}

export class PluginInstallWizard {
  private dialog: HTMLElement | null = null;
  private currentStep: number = 1;
  private totalSteps: number = 3;
  private selectedMethod: 'bundled' | 'folder' | 'url' | 'marketplace' = 'bundled';
  private pluginPath: string = '';
  private pluginUrl: string = '';
  private selectedBundledPlugin: string = '';
  private bundledPlugins: any[] = [];
  private options: PluginInstallOptions;

  constructor(options: PluginInstallOptions = {}) {
    this.options = options;
    this.loadBundledPlugins();
  }

  /**
   * Load bundled example plugins
   */
  private async loadBundledPlugins(): Promise<void> {
    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI && electronAPI.bundledPlugins) {
        this.bundledPlugins = await electronAPI.bundledPlugins.list();
      }
    } catch (error) {
      console.error('[PluginInstallWizard] Failed to load bundled plugins:', error);
      this.bundledPlugins = [];
    }
  }

  /**
   * Show the install wizard
   */
  show(): void {
    console.log('[PluginInstallWizard] show() called');
    try {
      this.createDialog();
      console.log('[PluginInstallWizard] Dialog created:', this.dialog);
      this.render();
      console.log('[PluginInstallWizard] Rendered');
      this.attachEventListeners();
      console.log('[PluginInstallWizard] Event listeners attached');
    } catch (error) {
      console.error('[PluginInstallWizard] Error in show():', error);
    }
  }

  /**
   * Hide the wizard
   */
  hide(): void {
    if (this.dialog) {
      this.dialog.remove();
      this.dialog = null;
    }
  }

  /**
   * Create the dialog container
   */
  private createDialog(): void {
    this.dialog = document.createElement('div');
    this.dialog.className = 'wizard-dialog plugin-install-wizard';
    document.body.appendChild(this.dialog);
  }

  /**
   * Render the wizard
   */
  private render(): void {
    if (!this.dialog) return;

    this.dialog.innerHTML = `
      <div class="wizard-backdrop"></div>
      <div class="wizard-content">
        <div class="wizard-header">
          <h2>Install Plugin</h2>
          <p class="wizard-subtitle">Add new functionality to FictionLab</p>
          <button class="wizard-close" title="Close">×</button>
        </div>

        <div class="wizard-progress">
          ${this.renderProgressSteps()}
        </div>

        <div class="wizard-body">
          ${this.renderCurrentStep()}
        </div>

        <div class="wizard-footer">
          <button class="wizard-btn secondary" id="wizard-back" ${this.currentStep === 1 ? 'disabled' : ''}>
            Back
          </button>
          <button class="wizard-btn secondary" id="wizard-cancel">
            Cancel
          </button>
          ${this.currentStep === this.totalSteps
            ? `<button class="wizard-btn primary" id="wizard-install">Install</button>`
            : `<button class="wizard-btn primary" id="wizard-next" ${!this.canProceed() ? 'disabled' : ''}>Next</button>`
          }
        </div>
      </div>
    `;
  }

  /**
   * Render progress steps
   */
  private renderProgressSteps(): string {
    const steps = [
      { num: 1, label: 'Method' },
      { num: 2, label: 'Source' },
      { num: 3, label: 'Confirm' },
    ];

    return steps.map(step => `
      <div class="wizard-step ${step.num === this.currentStep ? 'active' : ''} ${step.num < this.currentStep ? 'completed' : ''}">
        <div class="step-number">${step.num}</div>
        <div class="step-label">${step.label}</div>
      </div>
    `).join('');
  }

  /**
   * Render current step content
   */
  private renderCurrentStep(): string {
    switch (this.currentStep) {
      case 1:
        return this.renderStep1();
      case 2:
        return this.renderStep2();
      case 3:
        return this.renderStep3();
      default:
        return '';
    }
  }

  /**
   * Step 1: Choose installation method
   */
  private renderStep1(): string {
    return `
      <div class="wizard-step-content">
        <h3>How would you like to install the plugin?</h3>
        <div class="install-methods">
          <div class="install-method ${this.selectedMethod === 'bundled' ? 'selected' : ''}" data-method="bundled">
            <div class="method-icon">📦</div>
            <div class="method-info">
              <h4>Install Example Plugin</h4>
              <p>Choose from pre-installed example plugins (Recommended)</p>
            </div>
            <div class="method-check">✓</div>
          </div>

          <div class="install-method ${this.selectedMethod === 'folder' ? 'selected' : ''}" data-method="folder">
            <div class="method-icon">📁</div>
            <div class="method-info">
              <h4>Import from Folder</h4>
              <p>Install a plugin from a local directory on your computer</p>
            </div>
            <div class="method-check">✓</div>
          </div>

          <div class="install-method ${this.selectedMethod === 'url' ? 'selected' : ''}" data-method="url">
            <div class="method-icon">🌐</div>
            <div class="method-info">
              <h4>Install from URL</h4>
              <p>Download and install a plugin from a web address</p>
            </div>
            <div class="method-check">✓</div>
          </div>

          <div class="install-method disabled" data-method="marketplace">
            <div class="method-icon">🏪</div>
            <div class="method-info">
              <h4>Browse Marketplace</h4>
              <p>Coming soon - browse and install curated plugins</p>
            </div>
            <div class="method-check">✓</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Step 2: Specify plugin source
   */
  private renderStep2(): string {
    switch (this.selectedMethod) {
      case 'bundled':
        return `
          <div class="wizard-step-content">
            <h3>Select Example Plugin</h3>
            <p>Choose from the following pre-installed example plugins:</p>

            <div class="bundled-plugins-list">
              ${this.bundledPlugins.length > 0
                ? this.bundledPlugins.map(plugin => `
                  <div class="bundled-plugin ${this.selectedBundledPlugin === plugin.id ? 'selected' : ''} ${plugin.installed ? 'installed' : ''}"
                       data-plugin-id="${plugin.id}">
                    <div class="bundled-plugin-icon">${plugin.icon}</div>
                    <div class="bundled-plugin-info">
                      <h4>${this.escapeHtml(plugin.name)}</h4>
                      <p>${this.escapeHtml(plugin.description)}</p>
                      <div class="bundled-plugin-meta">
                        <span class="plugin-version">v${plugin.version}</span>
                        ${plugin.installed ? '<span class="plugin-installed">✓ Installed</span>' : ''}
                      </div>
                    </div>
                    <div class="bundled-plugin-check">✓</div>
                  </div>
                `).join('')
                : '<p class="no-bundled-plugins">No example plugins available.</p>'
              }
            </div>
          </div>
        `;

      case 'folder':
        return `
          <div class="wizard-step-content">
            <h3>Select Plugin Folder</h3>
            <p>Choose the directory containing the plugin's <code>plugin.json</code> file.</p>

            <div class="plugin-source-input">
              <input type="text"
                     id="plugin-path-input"
                     placeholder="Select folder..."
                     value="${this.escapeHtml(this.pluginPath)}"
                     readonly>
              <button class="wizard-btn secondary" id="browse-folder">Browse...</button>
            </div>

            ${this.pluginPath ? `
              <div class="plugin-preview">
                <div class="preview-icon">📦</div>
                <div class="preview-info">
                  <strong>Selected:</strong> ${this.escapeHtml(this.getPluginFolderName())}
                </div>
              </div>
            ` : `
              <div class="plugin-help">
                <strong>Need a plugin?</strong><br>
                Check out the example plugins in:<br>
                <code>examples/claude-code-setup-plugin</code><br>
                <code>examples/claude-code-executor-plugin</code>
              </div>
            `}
          </div>
        `;

      case 'url':
        return `
          <div class="wizard-step-content">
            <h3>Enter Plugin URL</h3>
            <p>Provide a URL to download the plugin package (ZIP or Git repository).</p>

            <div class="plugin-source-input full">
              <input type="text"
                     id="plugin-url-input"
                     placeholder="https://github.com/user/plugin.git or https://example.com/plugin.zip"
                     value="${this.escapeHtml(this.pluginUrl)}">
            </div>

            <div class="plugin-help">
              <strong>Supported formats:</strong>
              <ul>
                <li>Git repositories (https://...git)</li>
                <li>ZIP archives (https://...zip)</li>
                <li>Direct folder URLs</li>
              </ul>
            </div>
          </div>
        `;

      default:
        return '<p>This method is not yet implemented.</p>';
    }
  }

  /**
   * Step 3: Confirm and install
   */
  private renderStep3(): string {
    return `
      <div class="wizard-step-content">
        <h3>Ready to Install</h3>

        <div class="install-summary">
          <div class="summary-row">
            <span class="summary-label">Installation Method:</span>
            <span class="summary-value">${this.getMethodName()}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Source:</span>
            <span class="summary-value">${this.escapeHtml(this.getSourceDisplay())}</span>
          </div>
        </div>

        <div class="install-info">
          <div class="info-icon">ℹ️</div>
          <div class="info-content">
            <strong>What happens next:</strong>
            <ol>
              <li>The plugin will be copied to your FictionLab plugins directory</li>
              <li>Dependencies will be installed automatically</li>
              <li>The plugin will be loaded and activated</li>
              <li>FictionLab may need to restart for changes to take effect</li>
            </ol>
          </div>
        </div>

        <div class="install-warning">
          <div class="warning-icon">⚠️</div>
          <div class="warning-content">
            <strong>Security Notice:</strong> Only install plugins from trusted sources.
            Plugins have access to your system and data.
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Check if we can proceed to next step
   */
  private canProceed(): boolean {
    switch (this.currentStep) {
      case 1:
        return true; // Always can proceed from method selection
      case 2:
        if (this.selectedMethod === 'bundled') {
          return this.selectedBundledPlugin.length > 0;
        } else if (this.selectedMethod === 'folder') {
          return this.pluginPath.length > 0;
        } else if (this.selectedMethod === 'url') {
          return this.pluginUrl.length > 0 && this.isValidUrl(this.pluginUrl);
        }
        return false;
      default:
        return true;
    }
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.dialog) return;

    // Close button
    const closeBtn = this.dialog.querySelector('.wizard-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.handleCancel());
    }

    // Backdrop click
    const backdrop = this.dialog.querySelector('.wizard-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => this.handleCancel());
    }

    // Cancel button
    const cancelBtn = this.dialog.querySelector('#wizard-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.handleCancel());
    }

    // Back button
    const backBtn = this.dialog.querySelector('#wizard-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.handleBack());
    }

    // Next button
    const nextBtn = this.dialog.querySelector('#wizard-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.handleNext());
    }

    // Install button
    const installBtn = this.dialog.querySelector('#wizard-install');
    if (installBtn) {
      installBtn.addEventListener('click', () => this.handleInstall());
    }

    // Step-specific listeners
    this.attachStepListeners();
  }

  /**
   * Attach step-specific event listeners
   */
  private attachStepListeners(): void {
    if (!this.dialog) return;

    switch (this.currentStep) {
      case 1:
        // Installation method selection
        this.dialog.querySelectorAll('.install-method:not(.disabled)').forEach(method => {
          method.addEventListener('click', () => {
            const methodType = (method as HTMLElement).dataset.method as 'bundled' | 'folder' | 'url' | 'marketplace';
            this.selectedMethod = methodType;
            this.render();
            this.attachEventListeners();
          });
        });
        break;

      case 2:
        if (this.selectedMethod === 'bundled') {
          // Bundled plugin selection
          this.dialog.querySelectorAll('.bundled-plugin:not(.installed)').forEach(pluginDiv => {
            pluginDiv.addEventListener('click', () => {
              const pluginId = (pluginDiv as HTMLElement).dataset.pluginId;
              if (pluginId) {
                this.selectedBundledPlugin = pluginId;
                this.render();
                this.attachEventListeners();
              }
            });
          });
        } else if (this.selectedMethod === 'folder') {
          // Browse folder button
          const browseBtn = this.dialog.querySelector('#browse-folder');
          if (browseBtn) {
            browseBtn.addEventListener('click', () => this.handleBrowseFolder());
          }
        } else if (this.selectedMethod === 'url') {
          // URL input
          const urlInput = this.dialog.querySelector('#plugin-url-input') as HTMLInputElement;
          if (urlInput) {
            urlInput.addEventListener('input', (e) => {
              this.pluginUrl = (e.target as HTMLInputElement).value;
              this.render();
              this.attachEventListeners();
            });
          }
        }
        break;
    }
  }

  /**
   * Handle folder browse
   */
  private async handleBrowseFolder(): Promise<void> {
    try {
      const electronAPI = (window as any).electronAPI;
      const result = await electronAPI.dialog.showOpenDialog({
        title: 'Select Plugin Folder',
        properties: ['openDirectory'],
        buttonLabel: 'Select Plugin Folder',
      });

      if (!result.canceled && result.filePaths.length > 0) {
        this.pluginPath = result.filePaths[0];
        this.render();
        this.attachEventListeners();
      }
    } catch (error) {
      console.error('[PluginInstallWizard] Failed to browse folder:', error);
      this.showError('Failed to open folder browser');
    }
  }

  /**
   * Handle back button
   */
  private handleBack(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.render();
      this.attachEventListeners();
    }
  }

  /**
   * Handle next button
   */
  private handleNext(): void {
    if (this.canProceed() && this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.render();
      this.attachEventListeners();
    }
  }

  /**
   * Handle cancel button
   */
  private handleCancel(): void {
    this.hide();
    if (this.options.onCancel) {
      this.options.onCancel();
    }
  }

  /**
   * Handle install button
   */
  private async handleInstall(): Promise<void> {
    try {
      // Update UI to show installing state
      this.showInstalling();

      const electronAPI = (window as any).electronAPI;
      let result: any;

      switch (this.selectedMethod) {
        case 'bundled':
          result = await electronAPI.bundledPlugins.install(this.selectedBundledPlugin);
          break;

        case 'folder':
          result = await electronAPI.import.plugin(this.pluginPath);
          break;

        case 'url':
          result = await electronAPI.import.pluginFromUrl(this.pluginUrl);
          break;

        default:
          throw new Error('Invalid installation method');
      }

      // Show success
      this.showSuccess(result || 'Plugin');

      // Call completion callback
      if (this.options.onComplete) {
        this.options.onComplete(true, result);
      }

      // Close wizard after brief delay
      setTimeout(() => this.hide(), 2000);

    } catch (error: any) {
      console.error('[PluginInstallWizard] Installation failed:', error);
      this.showError(error.message || 'Installation failed');

      // Call completion callback with failure
      if (this.options.onComplete) {
        this.options.onComplete(false);
      }
    }
  }

  /**
   * Show installing state
   */
  private showInstalling(): void {
    if (!this.dialog) return;

    const body = this.dialog.querySelector('.wizard-body');
    if (body) {
      body.innerHTML = `
        <div class="wizard-step-content installing">
          <div class="installing-spinner"></div>
          <h3>Installing Plugin...</h3>
          <p>Please wait while the plugin is being installed.</p>
        </div>
      `;
    }

    const footer = this.dialog.querySelector('.wizard-footer');
    if (footer) {
      (footer as HTMLElement).style.display = 'none';
    }
  }

  /**
   * Show success message
   */
  private showSuccess(pluginName: string): void {
    if (!this.dialog) return;

    const body = this.dialog.querySelector('.wizard-body');
    if (body) {
      body.innerHTML = `
        <div class="wizard-step-content success">
          <div class="success-icon">✓</div>
          <h3>Plugin Installed Successfully!</h3>
          <p><strong>${this.escapeHtml(pluginName)}</strong> has been installed.</p>
          <p class="success-note">FictionLab will reload to activate the plugin.</p>
        </div>
      `;
    }
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    if (!this.dialog) return;

    const body = this.dialog.querySelector('.wizard-body');
    if (body) {
      body.innerHTML = `
        <div class="wizard-step-content error">
          <div class="error-icon">✕</div>
          <h3>Installation Failed</h3>
          <p class="error-message">${this.escapeHtml(message)}</p>
          <button class="wizard-btn primary" id="try-again">Try Again</button>
        </div>
      `;

      // Try again button
      const tryAgainBtn = body.querySelector('#try-again');
      if (tryAgainBtn) {
        tryAgainBtn.addEventListener('click', () => {
          this.currentStep = 1;
          this.render();
          this.attachEventListeners();
        });
      }
    }
  }

  /**
   * Helper methods
   */
  private getMethodName(): string {
    switch (this.selectedMethod) {
      case 'bundled':
        return 'Example Plugin';
      case 'folder':
        return 'Import from Folder';
      case 'url':
        return 'Install from URL';
      case 'marketplace':
        return 'Browse Marketplace';
      default:
        return 'Unknown';
    }
  }

  private getSourceDisplay(): string {
    switch (this.selectedMethod) {
      case 'bundled':
        const plugin = this.bundledPlugins.find(p => p.id === this.selectedBundledPlugin);
        return plugin ? plugin.name : 'Not selected';
      case 'folder':
        return this.pluginPath || 'Not selected';
      case 'url':
        return this.pluginUrl || 'Not specified';
      default:
        return 'N/A';
    }
  }

  private getPluginFolderName(): string {
    if (!this.pluginPath) return '';
    const parts = this.pluginPath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || this.pluginPath;
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
