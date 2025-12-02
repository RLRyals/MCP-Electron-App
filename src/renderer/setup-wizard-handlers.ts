/**
 * Setup Wizard Renderer Logic
 * Orchestrates the entire first-run setup wizard flow
 */

// Note: ProgressTrackerUI and types are expected to be available from progress-tracker.js
// which should be loaded before this script

// Wizard state
let currentStep = 1;
let wizardState: any = null;
const WizardStep = (window as any).electronAPI.setupWizard.WizardStep;

// Get ProgressPhase and OperationType from global scope
const ProgressPhase = (window as any).ProgressPhase || {
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  ERROR: 'error'
};

const OperationType = (window as any).OperationType || {
  REPOSITORY_CLONE: 'repository_clone',
  NPM_BUILD: 'npm_build',
  DOCKER_BUILD: 'docker_build',
  CUSTOM_SCRIPT: 'custom_script'
};

// Progress tracker UI instance
let progressTrackerUI: any = null;

/**
 * Initialize the wizard on page load
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Setup wizard initializing...');

    try {
        // Load wizard state
        wizardState = await (window as any).electronAPI.setupWizard.getState();
        console.log('Wizard state:', wizardState);

        // Set current step from state
        currentStep = wizardState.currentStep || 1;

        // Initialize sidebar steps
        initializeSidebarSteps();

        // Show current step
        showStep(currentStep);

        // Update progress
        updateProgress();

        // Initialize step-specific content
        await initializeCurrentStep();

        // Attach event listeners
        attachEventListeners();
    } catch (error) {
        console.error('Error initializing wizard:', error);
        showError('Failed to initialize wizard. Please restart the application.');
    }
});

/**
 * Attach event listeners to buttons
 */
function attachEventListeners() {
    // Navigation buttons
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const checkPrereqBtn = document.getElementById('check-prerequisites-btn');
    const manualBuildBtn = document.getElementById('manual-start-build-btn');

    if (nextBtn) {
        nextBtn.addEventListener('click', nextStep);
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', previousStep);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelWizard);
    }

    if (checkPrereqBtn) {
        checkPrereqBtn.addEventListener('click', checkPrerequisites);
    }

    if (manualBuildBtn) {
        manualBuildBtn.addEventListener('click', () => {
            console.log('Manual build button clicked');
            initializeDownloadStep();
        });
    }
}

/**
 * Initialize sidebar step navigation
 */
function initializeSidebarSteps() {
    const stepsContainer = document.getElementById('wizard-steps');
    if (!stepsContainer) return;

    const steps = [
        { number: 1, name: 'Welcome', description: 'Getting started' },
        { number: 2, name: 'Prerequisites', description: 'System requirements' },
        { number: 3, name: 'Environment', description: 'Configuration' },
        { number: 4, name: 'Client Selection', description: 'Choose clients' },
        { number: 5, name: 'Download & Setup', description: 'Preparing components' },
        { number: 6, name: 'System Startup', description: 'Starting services' },
        { number: 7, name: 'Complete', description: 'All done!' }
    ];

    stepsContainer.innerHTML = '';

    steps.forEach(step => {
        const stepItem = document.createElement('div');
        stepItem.className = 'wizard-step-item';
        stepItem.id = `sidebar-step-${step.number}`;

        // Check if step is completed
        if (wizardState.stepsCompleted.includes(step.number)) {
            stepItem.classList.add('completed');
        }

        // Check if step is current
        if (step.number === currentStep) {
            stepItem.classList.add('active');
        }

        stepItem.innerHTML = `
            <div class="step-number">${step.number}</div>
            <div class="step-info">
                <div class="step-name">${step.name}</div>
                <div class="step-description">${step.description}</div>
            </div>
        `;

        // Allow navigation to completed steps or current step
        if (wizardState.stepsCompleted.includes(step.number) || step.number === currentStep) {
            stepItem.addEventListener('click', () => goToStep(step.number));
        }

        stepsContainer.appendChild(stepItem);
    });
}

/**
 * Show a specific wizard step
 */
function showStep(stepNumber: number) {
    // Hide all steps
    document.querySelectorAll('.wizard-step-content').forEach(el => {
        el.classList.remove('active');
    });

    // Show current step
    const stepElement = document.getElementById(`step-${stepNumber}`);
    if (stepElement) {
        stepElement.classList.add('active');
    }

    // Update sidebar
    document.querySelectorAll('.wizard-step-item').forEach(el => {
        el.classList.remove('active');
    });
    const sidebarStep = document.getElementById(`sidebar-step-${stepNumber}`);
    if (sidebarStep) {
        sidebarStep.classList.add('active');
    }

    // Update header
    updateHeader(stepNumber);

    // Update navigation buttons
    updateNavigationButtons(stepNumber);

    currentStep = stepNumber;
}

/**
 * Update wizard header based on current step
 */
async function updateHeader(stepNumber: number) {
    const titleEl = document.getElementById('wizard-title');
    const subtitleEl = document.getElementById('wizard-subtitle');

    if (!titleEl || !subtitleEl) return;

    try {
        const stepName = await (window as any).electronAPI.setupWizard.getStepName(stepNumber);
        const stepDesc = await (window as any).electronAPI.setupWizard.getStepDescription(stepNumber);

        titleEl.textContent = stepName;
        subtitleEl.textContent = stepDesc;
    } catch (error) {
        console.error('Error updating header:', error);
    }
}

/**
 * Update navigation buttons state
 */
function updateNavigationButtons(stepNumber: number) {
    const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
    const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;

    if (!prevBtn || !nextBtn) return;

    // Previous button
    prevBtn.disabled = stepNumber === 1;

    // Next/Finish button
    if (stepNumber === 7) {
        nextBtn.textContent = 'Launch Dashboard';
        nextBtn.classList.remove('primary');
        nextBtn.classList.add('primary');
    } else {
        nextBtn.textContent = 'Next';
    }
}

/**
 * Update overall progress bar
 */
async function updateProgress() {
    const progressBar = document.getElementById('overall-progress-bar') as HTMLElement;
    const progressPercentage = document.getElementById('overall-progress-percentage') as HTMLElement;

    if (!progressBar || !progressPercentage) return;

    try {
        const progress = await (window as any).electronAPI.setupWizard.getProgress();
        progressBar.style.width = `${progress}%`;
        progressPercentage.textContent = `${progress}%`;
    } catch (error) {
        console.error('Error updating progress:', error);
    }
}

/**
 * Initialize content for current step
 */
async function initializeCurrentStep() {
    switch (currentStep) {
        case 1:
            // Welcome - no initialization needed
            break;
        case 2:
            await initializePrerequisitesStep();
            break;
        case 3:
            await initializeEnvironmentStep();
            break;
        case 4:
            await initializeClientSelectionStep();
            break;
        case 5:
            await initializeDownloadStep();
            break;
        case 6:
            await initializeSystemStartupStep();
            break;
        case 7:
            await initializeCompleteStep();
            break;
    }
}

/**
 * Step 2: Initialize Prerequisites Check
 */
async function initializePrerequisitesStep() {
    await checkPrerequisites();
}

/**
 * Check all prerequisites
 */
async function checkPrerequisites() {
    const grid = document.getElementById('prereq-grid');
    if (!grid) return;

    grid.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="spinner"></div><p style="margin-top: 20px;">Checking prerequisites...</p></div>';

    try {
        const results = await (window as any).electronAPI.prerequisites.checkAll();
        console.log('Prerequisites check results:', results);

        let allValid = true;
        const cards: string[] = [];

        // Docker card
        const dockerValid = results.docker.installed && results.docker.running;
        if (!dockerValid) allValid = false;

        cards.push(createPrerequisiteCard(
            'Docker Desktop',
            '🐳',
            dockerValid,
            results.docker.installed ? (results.docker.running ? `Running (${results.docker.version})` : 'Not running') : 'Not installed',
            dockerValid ? null : 'Docker Desktop is required. Click below to install.'
        ));

        // Git card
        const gitValid = results.git.installed;
        if (!gitValid) allValid = false;

        cards.push(createPrerequisiteCard(
            'Git',
            '📦',
            gitValid,
            results.git.installed ? `Installed (${results.git.version})` : 'Not installed',
            gitValid ? null : 'Git is required for version control.'
        ));

        // WSL card (Windows only)
        if (results.wsl) {
            const wslValid = results.wsl.installed;
            if (!wslValid) allValid = false;

            cards.push(createPrerequisiteCard(
                'WSL',
                '🐧',
                wslValid,
                results.wsl.installed ? 'Installed' : 'Not installed',
                wslValid ? null : 'WSL is required on Windows.'
            ));
        }

        grid.innerHTML = cards.join('');

        // Show alert if not all prerequisites are met
        const alertContainer = document.getElementById('prereq-alert-container');
        if (alertContainer) {
            if (!allValid) {
                alertContainer.innerHTML = `
                    <div class="alert error">
                        <span style="font-size: 1.5rem;">⚠️</span>
                        <div>
                            <strong>Prerequisites Not Met</strong><br>
                            Please install the required software before continuing.
                        </div>
                    </div>
                `;
            } else {
                alertContainer.innerHTML = `
                    <div class="alert success">
                        <span style="font-size: 1.5rem;">✓</span>
                        <div>
                            <strong>All Prerequisites Met</strong><br>
                            Your system is ready for installation!
                        </div>
                    </div>
                `;

                // Save prerequisites state
                await (window as any).electronAPI.setupWizard.saveState(WizardStep.PREREQUISITES, {
                    prerequisites: {
                        docker: true,
                        git: true,
                        wsl: results.wsl?.installed || undefined
                    }
                });
            }
        }

        // Add event listeners for installation buttons
        if (!dockerValid && !results.docker.installed) {
            const installDockerBtn = document.getElementById('install-docker-btn');
            if (installDockerBtn) {
                installDockerBtn.addEventListener('click', async () => {
                    await (window as any).electronAPI.wizard.openDownloadPage();
                });
            }
        }

    } catch (error) {
        console.error('Error checking prerequisites:', error);
        grid.innerHTML = `
            <div class="alert error">
                <span style="font-size: 1.5rem;">⚠️</span>
                <div>
                    <strong>Error Checking Prerequisites</strong><br>
                    ${error instanceof Error ? error.message : String(error)}
                </div>
            </div>
            ${createRetryButton('retry-prereq-check-btn', checkPrerequisites, 'Check Again')}
        `;
    }
}

/**
 * Create prerequisite card HTML
 */
function createPrerequisiteCard(
    title: string,
    icon: string,
    success: boolean,
    status: string,
    error: string | null
): string {
    return `
        <div class="prereq-card ${success ? 'success' : 'error'}">
            <div class="prereq-header">
                <div class="prereq-icon">${icon}</div>
                <div class="prereq-title">${title}</div>
            </div>
            <div class="prereq-status">
                <strong>Status:</strong> ${status}
            </div>
            ${error ? `
                <div class="prereq-status" style="margin-top: 10px; background: rgba(244, 67, 54, 0.1);">
                    ${error}
                </div>
                ${title === 'Docker Desktop' ? `
                    <div class="prereq-actions">
                        <button class="wizard-btn" id="install-docker-btn">Install Docker</button>
                    </div>
                ` : ''}
            ` : ''}
        </div>
    `;
}

/**
 * Step 3: Initialize Environment Configuration
 */
async function initializeEnvironmentStep() {
    const container = document.getElementById('env-config-container');
    if (!container) return;

    try {
        // Load current configuration
        const config = await (window as any).electronAPI.envConfig.getConfig();

        // Create environment configuration form
        container.innerHTML = createEnvironmentConfigForm(config);

        // Add event listeners
        setupEnvironmentFormListeners();

        // Check for port conflicts
        checkPortConflicts(config);

        // Check if already configured
        if (wizardState.data.environment?.saved) {
            showSuccessMessage('Configuration previously saved', 'env-config-container');
        }

    } catch (error) {
        console.error('Error loading environment config:', error);
        container.innerHTML = `
            <div class="alert error">
                <span style="font-size: 1.5rem;">⚠️</span>
                <div>
                    <strong>Error Loading Configuration</strong><br>
                    ${error instanceof Error ? error.message : String(error)}
                </div>
            </div>
        `;
    }
}

/**
 * Check for port conflicts and update UI
 */
async function checkPortConflicts(config: any) {
    const conflictContainer = document.getElementById('port-conflict-container');
    if (!conflictContainer) return;

    try {
        conflictContainer.innerHTML = '<div style="padding: 10px; text-align: center; color: #aaa;">Checking ports...</div>';
        
        const result = await (window as any).electronAPI.envConfig.checkAllPorts(config);
        
        if (result.hasConflicts) {
            const conflictList = result.conflicts.map((c: any) => 
                `<li><strong>${c.name}</strong>: Port ${c.port} is in use (Suggested: ${c.suggested})</li>`
            ).join('');

            conflictContainer.innerHTML = `
                <div class="alert warning" style="margin-bottom: 20px;">
                    <span style="font-size: 1.5rem;">⚠️</span>
                    <div style="flex: 1;">
                        <strong>Port Conflicts Detected</strong>
                        <p style="margin: 5px 0;">The following ports are already in use:</p>
                        <ul style="margin: 5px 0 10px 20px; padding: 0;">
                            ${conflictList}
                        </ul>
                        <button id="use-suggested-ports-btn" class="wizard-btn secondary" style="padding: 8px 15px; font-size: 0.9rem;">
                            Use Suggested Ports
                        </button>
                    </div>
                </div>
            `;

            // Add event listener for the button
            document.getElementById('use-suggested-ports-btn')?.addEventListener('click', () => {
                if (result.suggestedConfig) {
                    applySuggestedConfig(result.suggestedConfig);
                }
            });
        } else {
            conflictContainer.innerHTML = ''; // No conflicts
        }
    } catch (error) {
        console.error('Error checking port conflicts:', error);
        conflictContainer.innerHTML = `
            <div class="alert error" style="margin-bottom: 20px;">
                <strong>Error checking ports:</strong> ${error instanceof Error ? error.message : String(error)}
            </div>
        `;
    }
}

/**
 * Apply suggested configuration to form
 */
function applySuggestedConfig(config: any) {
    const fields = [
        { id: 'postgres-port', key: 'POSTGRES_PORT' },
        { id: 'mcp-port', key: 'MCP_CONNECTOR_PORT' },
        { id: 'http-port', key: 'HTTP_SSE_PORT' },
        { id: 'db-admin-port', key: 'DB_ADMIN_PORT' },
        { id: 'typing-mind-port', key: 'TYPING_MIND_PORT' }
    ];

    fields.forEach(field => {
        const input = document.getElementById(field.id) as HTMLInputElement;
        if (input && config[field.key]) {
            input.value = config[field.key];
            // Highlight change
            input.style.borderColor = '#4CAF50';
            setTimeout(() => {
                input.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }, 2000);
        }
    });

    // Re-check conflicts with new values
    checkPortConflicts(config);
    
    // Show success message
    const conflictContainer = document.getElementById('port-conflict-container');
    if (conflictContainer) {
        conflictContainer.innerHTML = `
            <div class="alert success" style="margin-bottom: 20px;">
                <span style="font-size: 1.5rem;">✓</span>
                <div>
                    <strong>Ports Updated</strong><br>
                    Applied suggested available ports.
                </div>
            </div>
        `;
        setTimeout(() => {
            if (conflictContainer) conflictContainer.innerHTML = '';
        }, 3000);
    }
}

/**
 * Create environment configuration form HTML
 */
function createEnvironmentConfigForm(config: any): string {
    return `
        <div style="background: rgba(255, 255, 255, 0.1); padding: 30px; border-radius: 15px;">
            <div id="port-conflict-container"></div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
                <div>
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Database Name</label>
                    <input type="text" id="postgres-db" value="${config.POSTGRES_DB}" style="width: 100%; padding: 10px; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #fff; font-size: 1rem;">
                </div>

                <div>
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Database User</label>
                    <input type="text" id="postgres-user" value="${config.POSTGRES_USER}" style="width: 100%; padding: 10px; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #fff; font-size: 1rem;">
                </div>

                <div>
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">PostgreSQL Port</label>
                    <input type="number" id="postgres-port" value="${config.POSTGRES_PORT}" min="1024" max="65535" style="width: 100%; padding: 10px; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #fff; font-size: 1rem;">
                </div>

                <div>
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">MCP Connector Port</label>
                    <input type="number" id="mcp-connector-port" value="${config.MCP_CONNECTOR_PORT}" min="1024" max="65535" style="width: 100%; padding: 10px; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #fff; font-size: 1rem;">
                </div>

                <div>
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">HTTP/SSE Port</label>
                    <input type="number" id="http-sse-port" value="${config.HTTP_SSE_PORT}" min="1024" max="65535" style="width: 100%; padding: 10px; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #fff; font-size: 1rem;">
                </div>

                <div>
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">DB Admin Port</label>
                    <input type="number" id="db-admin-port" value="${config.DB_ADMIN_PORT}" min="1024" max="65535" style="width: 100%; padding: 10px; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #fff; font-size: 1rem;">
                </div>

                <div>
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Typing Mind Port</label>
                    <input type="number" id="typing-mind-port" value="${config.TYPING_MIND_PORT}" min="1024" max="65535" style="width: 100%; padding: 10px; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #fff; font-size: 1rem;">
                </div>
            </div>

            <div style="margin-top: 30px; display: flex; gap: 15px; justify-content: flex-end;">
                <button class="wizard-btn secondary" id="reset-env-config-btn">Reset to Defaults</button>
                <button class="wizard-btn primary" id="save-env-config-btn">Save Configuration</button>
            </div>

            <div id="env-config-status" style="margin-top: 20px;"></div>
        </div>
    `;
}

/**
 * Setup environment form event listeners
 */
function setupEnvironmentFormListeners() {
    const saveBtn = document.getElementById('save-env-config-btn');
    const resetBtn = document.getElementById('reset-env-config-btn');

    if (saveBtn) {
        saveBtn.addEventListener('click', saveEnvironmentConfig);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            await (window as any).electronAPI.envConfig.resetDefaults();
            await initializeEnvironmentStep();
        });
    }
}

/**
 * Save environment configuration
 */
async function saveEnvironmentConfig(): Promise<boolean> {
    const statusEl = document.getElementById('env-config-status');

    try {
        // Get form values
        const config = {
            POSTGRES_DB: (document.getElementById('postgres-db') as HTMLInputElement).value,
            POSTGRES_USER: (document.getElementById('postgres-user') as HTMLInputElement).value,
            POSTGRES_PASSWORD: '', // Will be auto-generated
            POSTGRES_PORT: parseInt((document.getElementById('postgres-port') as HTMLInputElement).value),
            MCP_CONNECTOR_PORT: parseInt((document.getElementById('mcp-connector-port') as HTMLInputElement).value),
            HTTP_SSE_PORT: parseInt((document.getElementById('http-sse-port') as HTMLInputElement).value),
            DB_ADMIN_PORT: parseInt((document.getElementById('db-admin-port') as HTMLInputElement).value),
            MCP_AUTH_TOKEN: '', // Will be auto-generated
            TYPING_MIND_PORT: parseInt((document.getElementById('typing-mind-port') as HTMLInputElement).value)
        };

        // Get current config to check if credentials already exist
        const currentConfig = await (window as any).electronAPI.envConfig.getConfig();
        
        // Check if .env file actually exists on disk
        // This is critical to prevent password regeneration
        const envFileExists = await (window as any).electronAPI.envConfig.fileExists();
        
        console.log('Environment file exists:', envFileExists);
        console.log('Current config has password:', !!currentConfig.POSTGRES_PASSWORD);
        console.log('Current config has token:', !!currentConfig.MCP_AUTH_TOKEN);

        // CRITICAL: Only generate NEW credentials if this is first-time setup (.env doesn't exist)
        // If .env exists, ALWAYS use the existing credentials, NEVER regenerate
        if (!envFileExists) {
            // First-time setup - generate new credentials
            console.log('First-time setup detected - generating new credentials...');
            config.POSTGRES_PASSWORD = await (window as any).electronAPI.envConfig.generatePassword(16);
            config.MCP_AUTH_TOKEN = await (window as any).electronAPI.envConfig.generateToken();
        } else {
            // .env file exists - ALWAYS use existing credentials from the file
            console.log('Using existing credentials from .env file');
            config.POSTGRES_PASSWORD = currentConfig.POSTGRES_PASSWORD;
            config.MCP_AUTH_TOKEN = currentConfig.MCP_AUTH_TOKEN;
            
            // If somehow the credentials are empty in an existing .env file, this is an error
            if (!config.POSTGRES_PASSWORD || config.POSTGRES_PASSWORD.trim() === '') {
                throw new Error('POSTGRES_PASSWORD is empty in existing .env file. This indicates a corrupted configuration. Please delete the .env file and restart the setup wizard to generate new credentials.');
            }
            if (!config.MCP_AUTH_TOKEN || config.MCP_AUTH_TOKEN.trim() === '') {
                throw new Error('MCP_AUTH_TOKEN is empty in existing .env file. This indicates a corrupted configuration. Please delete the .env file and restart the setup wizard to generate new credentials.');
            }
        }

        // Final validation: ensure credentials are NEVER empty
        if (!config.POSTGRES_PASSWORD || config.POSTGRES_PASSWORD.trim() === '') {
            throw new Error('POSTGRES_PASSWORD is empty - this should never happen. Please report this bug.');
        }
        if (!config.MCP_AUTH_TOKEN || config.MCP_AUTH_TOKEN.trim() === '') {
            throw new Error('MCP_AUTH_TOKEN is empty - this should never happen. Please report this bug.');
        }

        if (statusEl) {
            statusEl.innerHTML = '<div class="spinner" style="display: inline-block;"></div> Saving configuration...';
        }

        console.log('Saving configuration with credentials:', {
            hasPassword: !!config.POSTGRES_PASSWORD,
            hasToken: !!config.MCP_AUTH_TOKEN,
            passwordLength: config.POSTGRES_PASSWORD?.length,
            tokenLength: config.MCP_AUTH_TOKEN?.length
        });

        // Save configuration
        const result = await (window as any).electronAPI.envConfig.saveConfig(config);

        if (result.success) {
            // Save wizard state
            await (window as any).electronAPI.setupWizard.saveState(WizardStep.ENVIRONMENT, {
                environment: {
                    saved: true,
                    configPath: result.path
                }
            });

            if (statusEl) {
                statusEl.innerHTML = `
                    <div class="alert success">
                        <span style="font-size: 1.5rem;">✓</span>
                        <div>
                            <strong>Configuration Saved</strong><br>
                            Settings saved successfully to ${result.path}
                        </div>
                    </div>
                `;
            }
            return true;
        } else {
            throw new Error(result.error || 'Failed to save configuration');
        }

    } catch (error) {
        console.error('Error saving environment config:', error);
        if (statusEl) {
            statusEl.innerHTML = `
                <div class="alert error">
                    <span style="font-size: 1.5rem;">⚠️</span>
                    <div>
                        <strong>Error Saving Configuration</strong><br>
                        ${error instanceof Error ? error.message : String(error)}
                    </div>
                </div>
            `;
        }
        return false;
    }
}

/**
 * Step 4: Initialize Client Selection
 */
async function initializeClientSelectionStep() {
    const container = document.getElementById('client-selection-container');
    if (!container) return;

    try {
        // Load available clients
        const clients = await (window as any).electronAPI.clientSelection.getOptions();
        console.log('Available clients:', clients);

        // Get current selection
        const selection = await (window as any).electronAPI.clientSelection.getSelection();
        const selectedClients = selection?.clients || [];

        // Create client cards
        container.innerHTML = createClientSelectionCards(clients, selectedClients);

        // Add event listeners
        setupClientSelectionListeners();

    } catch (error) {
        console.error('Error loading client selection:', error);
        container.innerHTML = `
            <div class="alert error">
                <span style="font-size: 1.5rem;">⚠️</span>
                <div>
                    <strong>Error Loading Clients</strong><br>
                    ${error instanceof Error ? error.message : String(error)}
                </div>
            </div>
        `;
    }
}

/**
 * Create client selection cards HTML
 */
function createClientSelectionCards(clients: any[], selectedClients: string[]): string {
    const cards = clients.map(client => `
        <div class="prereq-card ${selectedClients.includes(client.id) ? 'success' : ''}" data-client-id="${client.id}">
            <div class="prereq-header">
                <div class="prereq-icon">${client.type === 'web-based' ? '🌐' : '💻'}</div>
                <div style="flex: 1;">
                    <div class="prereq-title">${client.name}</div>
                    <div style="margin-top: 5px;">
                        <span style="display: inline-block; padding: 4px 12px; background: rgba(255, 255, 255, 0.2); border-radius: 12px; font-size: 0.85rem;">${client.type}</span>
                    </div>
                </div>
                <input type="checkbox" class="client-checkbox" data-client-id="${client.id}" ${selectedClients.includes(client.id) ? 'checked' : ''} style="width: 24px; height: 24px; cursor: pointer;">
            </div>
            <div style="margin-top: 15px; opacity: 0.9;">
                ${client.description}
            </div>
            <div style="margin-top: 15px;">
                <strong>Features:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    ${client.features.map((f: string) => `<li style="margin: 5px 0;">${f}</li>`).join('')}
                </ul>
            </div>
            <div style="margin-top: 10px;">
                <strong>Requirements:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    ${client.requirements.map((r: string) => `<li style="margin: 5px 0;">${r}</li>`).join('')}
                </ul>
            </div>
        </div>
    `).join('');

    return `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">
            ${cards}
        </div>
        <div style="margin-top: 30px; text-align: right;">
            <button class="wizard-btn primary" id="save-client-selection-btn">Save Selection</button>
        </div>
        <div id="client-selection-status" style="margin-top: 20px;"></div>
    `;
}

/**
 * Setup client selection event listeners
 */
function setupClientSelectionListeners() {
    // Checkbox change listeners
    document.querySelectorAll('.client-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            const clientId = target.getAttribute('data-client-id');
            const card = document.querySelector(`.prereq-card[data-client-id="${clientId}"]`);

            if (target.checked) {
                card?.classList.add('success');
            } else {
                card?.classList.remove('success');
            }
        });
    });

    // Save button
    const saveBtn = document.getElementById('save-client-selection-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveClientSelection);
    }
}

/**
 * Save client selection
 */
async function saveClientSelection(): Promise<boolean> {
    const statusEl = document.getElementById('client-selection-status');

    try {
        // Get selected clients
        const selectedClients: string[] = [];
        document.querySelectorAll('.client-checkbox:checked').forEach(checkbox => {
            const clientId = checkbox.getAttribute('data-client-id');
            if (clientId) selectedClients.push(clientId);
        });

        console.log('Selected clients:', selectedClients);

        if (statusEl) {
            statusEl.innerHTML = '<div class="spinner" style="display: inline-block;"></div> Saving selection...';
        }

        // Save selection
        const result = await (window as any).electronAPI.clientSelection.saveSelection(selectedClients);

        if (result.success) {
            // Save wizard state
            const saveStateResult = await (window as any).electronAPI.setupWizard.saveState(WizardStep.CLIENT_SELECTION, {
                clients: selectedClients
            });

            if (!saveStateResult.success) {
                throw new Error(`Failed to save wizard state: ${saveStateResult.error}`);
            }

            if (statusEl) {
                statusEl.innerHTML = `
                    <div class="alert success">
                        <span style="font-size: 1.5rem;">✓</span>
                        <div>
                            <strong>Selection Saved</strong><br>
                            ${selectedClients.length} client(s) selected: ${selectedClients.join(', ')}
                        </div>
                    </div>
                `;
            }

            return true;
        } else {
            throw new Error(result.error || 'Failed to save selection');
        }

    } catch (error) {
        console.error('Error saving client selection:', error);
        if (statusEl) {
            statusEl.innerHTML = `
                <div class="alert error">
                    <span style="font-size: 1.5rem;">⚠️</span>
                    <div>
                        <strong>Error Saving Selection</strong><br>
                        ${error instanceof Error ? error.message : String(error)}
                    </div>
                </div>
            `;
        }
        return false;
    }
}

/**
 * Step 5: Initialize Build Pipeline
 * Create retry button HTML
 */
function createRetryButton(buttonId: string, stepFunction: () => void, buttonText: string = 'Retry'): string {
    // Schedule event listener attachment
    setTimeout(() => {
        const retryBtn = document.getElementById(buttonId);
        if (retryBtn) {
            retryBtn.addEventListener('click', stepFunction);
        }
    }, 0);

    return `
        <div style="margin-top: 20px; text-align: center;">
            <button class="wizard-btn primary" id="${buttonId}" style="padding: 12px 24px; font-size: 1rem;">
                <span style="margin-right: 8px;">↻</span> ${buttonText}
            </button>
        </div>
    `;
}

/**
 * Step 5: Initialize Download & Setup
 */
async function initializeDownloadStep() {
    console.log('initializeDownloadStep called');
    const statusContainer = document.getElementById('download-status-container');
    const manualBuildBtn = document.getElementById('manual-start-build-btn');
    console.log('statusContainer:', statusContainer);
    console.log('manualBuildBtn:', manualBuildBtn);

    if (!statusContainer) {
        console.log('ERROR: statusContainer not found!');
        return;
    }

    // Hide the manual build button initially
    if (manualBuildBtn) {
        manualBuildBtn.style.display = 'none';
    }

    console.log('Initializing progress tracker UI');
    // Initialize progress tracker UI
    if (!progressTrackerUI) {
        progressTrackerUI = new ProgressTrackerUI();
    } else {
        progressTrackerUI.reset();
    }

    // Check if build already completed
    console.log('buildPipeline.completed:', wizardState.data.buildPipeline?.completed);
    if (wizardState.data.buildPipeline?.completed) {
        console.log('Build already completed, showing success message');
        statusContainer.innerHTML = `
            <div class="alert success">
                <span style="font-size: 1.5rem;">✓</span>
                <div>
                    <strong>Build Complete</strong><br>
                    All components have been built and prepared.
                </div>
            </div>
        `;
        return;
    }

    // If Typing Mind downloads are complete but build pipeline is not marked complete, show warning
    // This indicates a potential inconsistency in the state
    // Note: We only check typingMindCompleted since Docker images aren't used yet
    const needsTypingMind = wizardState.data.clients?.includes('typingmind');
    if (needsTypingMind &&
        wizardState.data.downloads?.typingMindCompleted &&
        !wizardState.data.buildPipeline?.completed) {
        console.log('WARNING: Typing Mind complete but build pipeline not marked complete - inconsistent state');
        statusContainer.innerHTML = `
            <div class="alert warning" style="background: rgba(255, 152, 0, 0.2); border: 2px solid rgba(255, 152, 0, 0.5); padding: 20px; border-radius: 12px;">
                <span style="font-size: 1.5rem;">⚠️</span>
                <div>
                    <strong>Build Status Inconsistent</strong><br>
                    Downloads appear complete but build pipeline is not marked finished. Click Retry to verify and complete the build.
                </div>
            </div>
            ${createRetryButton('retry-build-status-btn', initializeDownloadStep, 'Retry')}
        `;
        return;
    }

    // Initialize the downloads object at the start of the build process if it doesn't exist
    // This allows the validation to pass while the build is in progress
    // Note: dockerImagesCompleted is set to true since Docker images aren't used yet
    if (!wizardState.data.downloads) {
        console.log('Initializing downloads state object...');
        const initResult = await (window as any).electronAPI.setupWizard.saveState(WizardStep.DOWNLOAD_SETUP, {
            downloads: {
                typingMindCompleted: false,
                dockerImagesCompleted: true  // Set to true since Docker images aren't used yet
            }
        });

        if (!initResult.success) {
            throw new Error(`Failed to initialize downloads state: ${initResult.error}`);
        }

        // Refresh wizard state after initialization
        wizardState = await (window as any).electronAPI.setupWizard.getState();
        console.log('Downloads state initialized:', wizardState.data.downloads);
    } else {
        console.log('Downloads state already exists:', wizardState.data.downloads);
    }

    // Set a timeout to show manual build button if automatic initialization takes too long
    let manualBuildTimeout: NodeJS.Timeout | null = null;

    try {
        manualBuildTimeout = setTimeout(() => {
            console.log('Build initialization timeout - showing manual start button');
            if (manualBuildBtn) {
                manualBuildBtn.style.display = 'block';
                manualBuildBtn.textContent = 'Build appears to be stuck. Click here to try again.';
            }
        }, 10000); // 10 second timeout

        // Check Docker status before starting the build pipeline
        console.log('Checking Docker status before build pipeline...');
        console.log('electronAPI available:', !!(window as any).electronAPI);
        console.log('docker available:', !!(window as any).electronAPI?.docker);

        const dockerStatus = await (window as any).electronAPI.docker.healthCheck();
        console.log('Docker status:', dockerStatus);
        console.log('Docker running:', dockerStatus.running, 'Docker healthy:', dockerStatus.healthy);

        // If Docker is not installed
        if (!dockerStatus.running && !dockerStatus.healthy) {
            // Check if Docker is installed but not running
            const prereqResults = await (window as any).electronAPI.prerequisites.checkAll();

            if (!prereqResults.docker.installed) {
                // Docker is not installed - show download link
                statusContainer.innerHTML = `
                    <div class="alert error" style="background: rgba(244, 67, 54, 0.2); border: 2px solid rgba(244, 67, 54, 0.5); padding: 20px; border-radius: 12px;">
                        <span style="font-size: 1.5rem;">⚠️</span>
                        <div>
                            <strong>Docker Desktop Not Installed</strong><br>
                            Docker Desktop is required to run the MCP system. Please install Docker Desktop and restart the setup wizard.
                            <div style="margin-top: 20px;">
                                <a href="https://www.docker.com/products/docker-desktop/"
                                   target="_blank"
                                   class="wizard-btn primary"
                                   style="display: inline-block; padding: 12px 24px; text-decoration: none;">
                                    Download Docker Desktop
                                </a>
                            </div>
                            <div style="margin-top: 12px; padding: 12px; background: rgba(255, 255, 255, 0.1); border-radius: 8px; font-size: 0.9rem;">
                                <strong>After installing Docker Desktop:</strong>
                                <ol style="margin: 8px 0; padding-left: 20px;">
                                    <li>Install Docker Desktop for your operating system</li>
                                    <li>Start Docker Desktop</li>
                                    <li>Return to this wizard and click "Retry"</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                    ${createRetryButton('retry-docker-check-btn', initializeDownloadStep, 'Retry')}
                `;
                return;
            }

            // Docker is installed but not running - try to start it
            statusContainer.innerHTML = `
                <div class="alert warning" style="background: rgba(255, 152, 0, 0.2); border: 2px solid rgba(255, 152, 0, 0.5); padding: 20px; border-radius: 12px;">
                    <span style="font-size: 1.5rem;">⚠️</span>
                    <div>
                        <strong>Docker Desktop Not Running</strong><br>
                        Docker Desktop is installed but not running. Starting Docker Desktop...
                    </div>
                </div>
            `;

            console.log('Starting Docker Desktop...');

            // Listen for Docker progress updates
            (window as any).electronAPI.docker.onProgress((progress: any) => {
                console.log('Docker startup progress:', progress);
                statusContainer.innerHTML = `
                    <div class="alert info" style="background: rgba(33, 150, 243, 0.2); border: 2px solid rgba(33, 150, 243, 0.5); padding: 20px; border-radius: 12px;">
                        <span style="font-size: 1.5rem;">🐳</span>
                        <div>
                            <strong>Starting Docker Desktop</strong><br>
                            ${progress.message}
                            <div style="margin-top: 10px; background: rgba(255, 255, 255, 0.1); border-radius: 8px; overflow: hidden;">
                                <div style="height: 8px; background: linear-gradient(90deg, #4CAF50, #8BC34A); width: ${progress.percent}%; transition: width 0.3s;"></div>
                            </div>
                        </div>
                    </div>
                `;
            });

            // Try to start Docker and wait for it to be ready
            const startResult = await (window as any).electronAPI.docker.startAndWait();

            if (!startResult.success) {
                statusContainer.innerHTML = `
                    <div class="alert error" style="background: rgba(244, 67, 54, 0.2); border: 2px solid rgba(244, 67, 54, 0.5); padding: 20px; border-radius: 12px;">
                        <span style="font-size: 1.5rem;">⚠️</span>
                        <div>
                            <strong>Failed to Start Docker Desktop</strong><br>
                            ${startResult.error || 'Could not start Docker Desktop automatically.'}
                            <div style="margin-top: 12px; padding: 12px; background: rgba(255, 255, 255, 0.1); border-radius: 8px;">
                                <strong>Please try the following:</strong>
                                <ol style="margin: 8px 0; padding-left: 20px;">
                                    <li>Start Docker Desktop manually</li>
                                    <li>Wait for Docker to finish starting</li>
                                    <li>Click "Retry" below</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                    ${createRetryButton('retry-docker-start-btn', initializeDownloadStep, 'Retry')}
                `;
                return;
            }

            console.log('Docker Desktop started successfully');
        }

        // Docker is now running, proceed with the build pipeline
        // Get selected clients to determine which components to build
        const selection = await (window as any).electronAPI.clientSelection.getSelection();
        const selectedComponents = ['core-system']; // Always include core system

        // Add optional components based on client selection
        if (selection?.clients?.includes('typingmind')) {
            selectedComponents.push('typing-mind-component');
        }

        console.log('Starting build pipeline with components:', selectedComponents);

        // Path to setup configuration
        const configPath = './config/setup-config.json';

        // Map pipeline phases to operation types
        const phaseToOperationType: Record<string, string> = {
            'cloning': 'repository_clone',
            'building': 'npm_build',
            'docker': 'docker_build',
            'verifying': 'custom_script',
        };

        // Map phases to their base progress percentage (cumulative)
        const phaseBaseProgress: Record<string, number> = {
            'cloning': 0,      // 0-25%
            'building': 25,    // 25-50%
            'docker': 50,      // 50-75%
            'verifying': 75,   // 75-100%
        };

        // Each phase contributes 25% to overall progress
        const phaseWeight = 25;

        let currentOperationId: string | null = null;
        const startTime = new Date();

        // Listen for pipeline progress updates
        (window as any).electronAPI.pipeline.onProgress((progress: any) => {
            console.log('Pipeline progress:', progress);

            const { phase, message, percent, currentOperation } = progress;

            // Determine operation type from phase
            const operationType = phaseToOperationType[phase] || OperationType.CUSTOM_SCRIPT;

            // Create or update operation
            if (!currentOperationId || currentOperation !== currentOperationId) {
                currentOperationId = `${phase}-${Date.now()}`;

                progressTrackerUI?.updateOperation({
                    operationId: currentOperationId,
                    operationType,
                    name: message || `Phase: ${phase}`,
                    phase: ProgressPhase.IN_PROGRESS,
                    percent: percent || 0,
                    message: message || '',
                    startTime: new Date()
                });
            } else {
                progressTrackerUI?.updateOperation({
                    operationId: currentOperationId,
                    operationType,
                    name: message || `Phase: ${phase}`,
                    phase: ProgressPhase.IN_PROGRESS,
                    percent: percent || 0,
                    message: message || '',
                    startTime: new Date()
                });
            }

            // Add console output
            if (message) {
                progressTrackerUI?.addConsoleOutput({
                    operationId: currentOperationId,
                    timestamp: new Date(),
                    stream: 'stdout',
                    content: message
                });
            }

            // Calculate cumulative overall progress
            // Each phase contributes 25% to overall progress
            const baseProgress = phaseBaseProgress[phase] || 0;
            const phaseProgress = (percent || 0) * (phaseWeight / 100); // Scale phase percent to phase weight
            const overallPercent = Math.min(100, Math.round(baseProgress + phaseProgress));

            // Update overall progress
            progressTrackerUI?.updateOverallProgress({
                overallPercent,
                currentOperation: {
                    operationId: currentOperationId,
                    operationType,
                    name: message || `Phase: ${phase}`,
                    timestamp: new Date()
                },
                operations: [],
                totalOperations: 4, // 4 phases: clone, build, docker, verify
                completedOperations: Math.floor(overallPercent / 25),
                failedOperations: 0,
                phase: ProgressPhase.IN_PROGRESS,
                startTime
            });
        });

        // Execute the build pipeline
        console.log('Executing build pipeline with components:', selectedComponents);
        const result = await (window as any).electronAPI.pipeline.execute(configPath, {
            selectedComponents,
            skipDocker: false,
            skipVerification: false,
            force: false
        });

        console.log('Build pipeline execution result:', result);

        // Remove progress listener
        (window as any).electronAPI.pipeline.removeProgressListener();

        if (!result.success) {
            const errorMsg = result.error || result.message || 'Build pipeline failed';
            console.error('Pipeline failed with error:', errorMsg);
            throw new Error(errorMsg);
        }

        console.log('Build pipeline succeeded, will now save state');

        // Mark the final operation as complete
        if (currentOperationId) {
            progressTrackerUI.updateOperation({
                operationId: currentOperationId,
                operationType: OperationType.CUSTOM_SCRIPT,
                name: 'Build pipeline complete',
                phase: ProgressPhase.COMPLETE,
                percent: 100,
                message: 'All build steps completed successfully',
                startTime,
                endTime: new Date(),
                success: true
            });

            progressTrackerUI.addConsoleOutput({
                operationId: currentOperationId,
                timestamp: new Date(),
                stream: 'stdout',
                content: `Pipeline completed in ${result.result?.duration || 0}ms`
            });
        }

        // Update overall progress to 100%
        progressTrackerUI.updateOverallProgress({
            overallPercent: 100,
            operations: [],
            totalOperations: 4,
            completedOperations: 4,
            failedOperations: 0,
            phase: ProgressPhase.COMPLETE,
            startTime
        });

        // Save wizard state
        const saveResult = await (window as any).electronAPI.setupWizard.saveState(WizardStep.DOWNLOAD_SETUP, {
            buildPipeline: {
                completed: true,
                clonedRepositories: result.result?.clonedRepositories || [],
                builtRepositories: result.result?.builtRepositories || [],
                dockerImages: result.result?.dockerImages || [],
                verifiedArtifacts: result.result?.verifiedArtifacts || []
            },
            downloads: {
                typingMindCompleted: true,
                dockerImagesCompleted: true
            }
        });

        if (!saveResult.success) {
            throw new Error(`Failed to save wizard state: ${saveResult.error}`);
        }

        // Clear the manual build timeout since we successfully completed
        clearTimeout(manualBuildTimeout);

        // Refresh wizard state to ensure it's up to date
        wizardState = await (window as any).electronAPI.setupWizard.getState();

        statusContainer.innerHTML = `
            <div class="alert success" style="background: rgba(76, 175, 80, 0.2); border: 2px solid rgba(76, 175, 80, 0.5); padding: 20px; border-radius: 12px;">
                <span style="font-size: 1.5rem;">✓</span>
                <div>
                    <strong>Build Pipeline Complete</strong><br>
                    All components have been built and prepared successfully.
                </div>
            </div>
        `;

    } catch (error) {
        // Clear the timeout since we hit an error
        if (manualBuildTimeout) {
            clearTimeout(manualBuildTimeout);
        }

        console.error('Error during build pipeline:', error);
        console.error('Full error details:', error instanceof Error ? { message: error.message, stack: error.stack } : error);

        // Show error in the progress tracker UI
        if (progressTrackerUI) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorEvent = {
                operationId: 'pipeline-error',
                timestamp: new Date(),
                message: errorMessage,
                errorMessage: errorMessage,
                error: error instanceof Error ? error : String(error),
                recoverable: true,
                retryAction: 'Click Retry to try again'
            };
            progressTrackerUI.showError(errorEvent);

            progressTrackerUI.addConsoleOutput({
                operationId: 'download-error',
                timestamp: new Date(),
                stream: 'stderr',
                content: `ERROR: ${errorMessage}`
            });
        }

        const errorMsg = error instanceof Error ? error.message : String(error);
        statusContainer.innerHTML = `
            <div class="alert error" style="background: rgba(244, 67, 54, 0.2); border: 2px solid rgba(244, 67, 54, 0.5); padding: 20px; border-radius: 12px;">
                <span style="font-size: 1.5rem;">⚠️</span>
                <div>
                    <strong>Build Pipeline Failed</strong><br>
                    <code style="display: block; margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 4px; font-size: 0.9rem; word-break: break-word;">${escapeHtml(errorMsg)}</code>
                    <div style="margin-top: 12px; padding: 12px; background: rgba(255, 255, 255, 0.1); border-radius: 8px;">
                        <strong>Troubleshooting Steps:</strong>
                        <ul style="margin: 8px 0; padding-left: 20px;">
                            <li><strong>Check Docker:</strong> Ensure Docker Desktop is running</li>
                            <li><strong>Network:</strong> Verify your internet connection and ability to reach GitHub</li>
                            <li><strong>Disk Space:</strong> Ensure you have enough free disk space (at least 10GB recommended)</li>
                            <li><strong>Git:</strong> Verify Git is installed and configured</li>
                            <li><strong>Permissions:</strong> Check that you have read/write permissions in the installation directory</li>
                            <li><strong>Logs:</strong> Check the application logs for more detailed error information</li>
                        </ul>
                    </div>
                </div>
            </div>
            ${createRetryButton('retry-download-btn', initializeDownloadStep, 'Retry Download')}
        `;

        // Listen for retry event
        window.addEventListener('progress:retry', () => {
            initializeDownloadStep();
        }, { once: true });
    }
}

/**
 * Monitor service status and update UI
 */
let serviceMonitoringInterval: NodeJS.Timeout | null = null;

function stopServiceMonitoring() {
    if (serviceMonitoringInterval) {
        clearInterval(serviceMonitoringInterval);
        serviceMonitoringInterval = null;
    }
}

async function startServiceMonitoring() {
    const monitoringContainer = document.getElementById('service-monitoring-container');
    const serviceStatusList = document.getElementById('service-status-list');

    if (!monitoringContainer || !serviceStatusList) return;

    monitoringContainer.style.display = 'block';

    const updateServiceStatus = async () => {
        try {
            const detailedStatus = await (window as any).electronAPI.mcpSystem.getDetailedStatus();

            // Update service status list
            serviceStatusList.innerHTML = detailedStatus.services.map((service: any) => {
                const statusIcon = service.status === 'healthy' ? '✅' :
                                 service.status === 'running' ? '🟢' :
                                 service.status === 'starting' ? '🟡' :
                                 service.status === 'unhealthy' ? '❌' :
                                 service.status === 'stopped' ? '⭕' : '❓';

                const statusColor = service.status === 'healthy' ? '#4CAF50' :
                                  service.status === 'running' ? '#8BC34A' :
                                  service.status === 'starting' ? '#FFC107' :
                                  service.status === 'unhealthy' ? '#F44336' :
                                  service.status === 'stopped' ? '#9E9E9E' : '#757575';

                const urlHtml = service.url
                    ? `<a href="${service.url}" target="_blank" style="color: #64B5F6; text-decoration: none; margin-left: 8px; font-size: 0.85rem;">🔗 Open</a>`
                    : '';

                return `
                    <div style="padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border-left: 3px solid ${statusColor};">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 1.2rem;">${statusIcon}</span>
                                <div>
                                    <div style="font-weight: 500;">${service.serviceName}</div>
                                    <div style="font-size: 0.85rem; opacity: 0.7;">${service.message}</div>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                ${service.port ? `<div style="font-size: 0.85rem; opacity: 0.7;">Port ${service.port}</div>` : ''}
                                ${urlHtml}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Check if all services are ready
            if (detailedStatus.overall.ready) {
                stopServiceMonitoring();
                return true;
            }
        } catch (error) {
            console.error('Error updating service status:', error);
        }
        return false;
    };

    // Initial update
    const allReady = await updateServiceStatus();

    if (!allReady) {
        // Poll every 2 seconds
        serviceMonitoringInterval = setInterval(async () => {
            const ready = await updateServiceStatus();
            if (ready) {
                stopServiceMonitoring();
            }
        }, 2000);
    }
}

/**
 * Step 6: Initialize System Startup
 */
async function initializeSystemStartupStep() {
    const statusContainer = document.getElementById('startup-status-container');
    const progressEl = document.getElementById('startup-progress');
    const progressFill = document.getElementById('startup-progress-fill') as HTMLElement;
    const progressMessage = document.getElementById('startup-progress-message');

    if (!statusContainer || !progressEl || !progressFill || !progressMessage) return;

    // Stop any existing monitoring
    stopServiceMonitoring();

    // Check if system already started
    if (wizardState.data.systemStartup?.started && wizardState.data.systemStartup?.healthy) {
        statusContainer.innerHTML = `
            <div class="alert success">
                <span style="font-size: 1.5rem;">✓</span>
                <div>
                    <strong>System Running</strong><br>
                    MCP system is running and healthy.
                </div>
            </div>
        `;
        progressEl.classList.remove('show');
        return;
    }

    try {
        progressEl.classList.add('show');
        progressMessage.textContent = 'Checking Docker...';

        // Check if Docker is running
        const dockerCheck = await (window as any).electronAPI.prerequisites.checkDockerRunning();
        console.log('Docker check result:', dockerCheck);

        if (!dockerCheck.running) {
            if (!dockerCheck.installed) {
                throw new Error('Docker Desktop is not installed. Please install Docker Desktop and restart the wizard.');
            }

            // Docker is installed but not running - attempt to start it
            progressMessage.textContent = 'Starting Docker Desktop...';
            console.log('Docker is not running, attempting to start...');

            const startResult = await (window as any).electronAPI.docker.start();
            console.log('Docker start result:', startResult);

            if (!startResult.success) {
                throw new Error(`Failed to start Docker Desktop: ${startResult.message || startResult.error}. Please start Docker Desktop manually.`);
            }

            // Wait for Docker to be ready (with timeout)
            progressMessage.textContent = 'Waiting for Docker to be ready...';
            console.log('Waiting for Docker to become ready...');

            const maxWaitTime = 60000; // 60 seconds
            const checkInterval = 2000; // 2 seconds
            const startTime = Date.now();
            let dockerReady = false;

            while (Date.now() - startTime < maxWaitTime) {
                const recheckDocker = await (window as any).electronAPI.prerequisites.checkDockerRunning();
                console.log('Docker recheck:', recheckDocker);

                if (recheckDocker.running) {
                    dockerReady = true;
                    console.log('Docker is now running!');
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, checkInterval));
            }

            if (!dockerReady) {
                throw new Error('Docker Desktop took too long to start. Please ensure Docker Desktop is running and retry.');
            }
        }

        progressMessage.textContent = 'Starting MCP system...';

        // Listen for progress updates
        (window as any).electronAPI.mcpSystem.onProgress((progress: any) => {
            console.log('MCP system progress:', progress);
            progressFill.style.width = `${progress.percent}%`;
            progressMessage.textContent = progress.message;
        });

        // Start the system
        const result = await (window as any).electronAPI.mcpSystem.start();

        // Remove progress listener
        (window as any).electronAPI.mcpSystem.removeProgressListener();

        if (!result.success) {
            throw new Error(result.error || 'Failed to start system');
        }

        // System started successfully
        progressEl.classList.remove('show');

        statusContainer.innerHTML = `
            <div class="alert success">
                <span style="font-size: 1.5rem;">✓</span>
                <div>
                    <strong>System Started Successfully</strong><br>
                    Monitoring service health...
                </div>
            </div>
        `;

        // Start monitoring services
        await startServiceMonitoring();

        // Save wizard state
        await (window as any).electronAPI.setupWizard.saveState(WizardStep.SYSTEM_STARTUP, {
            systemStartup: {
                started: true,
                healthy: true
            }
        });

    } catch (error) {
        console.error('Error starting system:', error);
        progressEl.classList.remove('show');
        statusContainer.innerHTML = `
            <div class="alert error">
                <span style="font-size: 1.5rem;">⚠️</span>
                <div>
                    <strong>Startup Failed</strong><br>
                    ${error instanceof Error ? error.message : String(error)}
                    <div style="margin-top: 12px; padding: 12px; background: rgba(255, 255, 255, 0.1); border-radius: 8px;">
                        <strong>Suggested Actions:</strong>
                        <ul style="margin: 8px 0; padding-left: 20px;">
                            <li>Ensure Docker is running</li>
                            <li>Check that all required ports are available</li>
                            <li>Verify Docker containers can start</li>
                            <li>Retry - the system will attempt to recover automatically</li>
                        </ul>
                    </div>
                </div>
            </div>
            ${createRetryButton('retry-startup-btn', initializeSystemStartupStep, 'Retry Startup')}
        `;
    }
}

/**
 * Step 7: Initialize Complete Step
 */
async function initializeCompleteStep() {
    const summaryList = document.getElementById('setup-summary-list');
    const urlsContainer = document.getElementById('service-urls');

    if (!summaryList || !urlsContainer) return;

    try {
        // Build summary
        const summary: string[] = [];

        if (wizardState.data.prerequisites?.docker) {
            summary.push('Docker Desktop configured and running');
        }

        if (wizardState.data.environment?.saved) {
            summary.push('Environment configuration saved');
        }

        const clients = wizardState.data.clients || [];
        if (clients.length > 0) {
            summary.push(`${clients.length} client(s) selected: ${clients.join(', ')}`);
        }

        if (wizardState.data.downloads?.dockerImagesCompleted) {
            summary.push('Docker images loaded successfully');
        }

        if (wizardState.data.systemStartup?.healthy) {
            summary.push('MCP system started and healthy');
        }

        summaryList.innerHTML = summary.map(item => `<li>${item}</li>`).join('');

        // Get service URLs
        const urls = await (window as any).electronAPI.mcpSystem.getUrls();
        console.log('Service URLs:', urls);

        const urlItems: string[] = [];

        if (urls.postgres) {
            urlItems.push(createServiceUrlItem('PostgreSQL', urls.postgres, 'Database service'));
        }

        if (urls.mcpConnector) {
            urlItems.push(createServiceUrlItem('MCP Connector', urls.mcpConnector, 'MCP integration service'));
        }

        if (urls.typingMind) {
            urlItems.push(createServiceUrlItem('Typing Mind', urls.typingMind, 'Web-based chat interface', true));
        }

        urlsContainer.innerHTML += urlItems.join('');

    } catch (error) {
        console.error('Error initializing complete step:', error);
    }
}

/**
 * Create service URL item HTML
 */
function createServiceUrlItem(name: string, url: string, description: string, openable: boolean = false): string {
    const id = `service-url-${name.toLowerCase().replace(/\s+/g, '-')}`;
    const copyBtnId = `${id}-copy`;
    const openBtnId = `${id}-open`;

    const html = `
        <div class="service-url-item" id="${id}">
            <div class="service-url-info">
                <div class="service-url-label">${name}</div>
                <div class="service-url-value">${url}</div>
                <div style="font-size: 0.85rem; opacity: 0.8; margin-top: 5px;">${description}</div>
            </div>
            <div class="service-url-actions">
                <button class="icon-btn" id="${copyBtnId}" data-url="${escapeHtml(url)}">Copy</button>
                ${openable ? `<button class="icon-btn" id="${openBtnId}" data-url="${escapeHtml(url)}">Open</button>` : ''}
            </div>
        </div>
    `;

    // Schedule event listener attachment
    setTimeout(() => {
        const copyBtn = document.getElementById(copyBtnId);
        if (copyBtn) {
            copyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const urlToCopy = copyBtn.getAttribute('data-url') || '';
                copyToClipboard(urlToCopy);
            });
        }

        const openBtn = document.getElementById(openBtnId);
        if (openBtn) {
            openBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const urlToOpen = openBtn.getAttribute('data-url') || '';
                openBrowser(urlToOpen);
            });
        }
    }, 0);

    return html;
}

/**
 * Escape HTML special characters in strings
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Navigation functions
 */
async function nextStep() {
    // For ENVIRONMENT step, automatically save configuration before proceeding
    if (currentStep === WizardStep.ENVIRONMENT) {
        const saved = await saveEnvironmentConfig();
        if (!saved) {
            // Save failed, don't proceed
            return;
        }

        // Now complete the step and move to next
        const result = await (window as any).electronAPI.setupWizard.completeStep(currentStep);
        if (result.success && result.nextStep) {
            // Update wizard state
            wizardState = await (window as any).electronAPI.setupWizard.getState();

            // Show next step
            showStep(result.nextStep);

            // Initialize next step
            await initializeCurrentStep();

            // Update progress
            await updateProgress();

            // Update sidebar
            initializeSidebarSteps();
        }
        return;
    }

    // For CLIENT_SELECTION step, automatically save selection before proceeding
    if (currentStep === WizardStep.CLIENT_SELECTION) {
        const saved = await saveClientSelection();
        if (!saved) {
            // Save failed, don't proceed
            return;
        }

        // Now complete the step and move to next
        const result = await (window as any).electronAPI.setupWizard.completeStep(currentStep);
        if (result.success && result.nextStep) {
            // Update wizard state
            wizardState = await (window as any).electronAPI.setupWizard.getState();

            // Show next step
            showStep(result.nextStep);

            // Initialize next step
            await initializeCurrentStep();

            // Update progress
            await updateProgress();

            // Update sidebar
            initializeSidebarSteps();
        }
        return;
    }

    // Validate current step before proceeding
    const canProceed = await validateCurrentStep();

    if (!canProceed) {
        return;
    }

    if (currentStep === 7) {
        // Launch dashboard
        await launchDashboard();
        return;
    }

    // Complete current step and move to next
    const result = await (window as any).electronAPI.setupWizard.completeStep(currentStep);

    if (result.success && result.nextStep) {
        // Update wizard state
        wizardState = await (window as any).electronAPI.setupWizard.getState();

        // Show next step
        showStep(result.nextStep);

        // Initialize next step
        await initializeCurrentStep();

        // Update progress
        await updateProgress();

        // Update sidebar
        initializeSidebarSteps();
    }
}

async function previousStep() {
    if (currentStep <= 1) return;

    const prevStep = currentStep - 1;
    await goToStep(prevStep);
}

async function goToStep(stepNumber: number) {
    // Navigate to step
    await (window as any).electronAPI.setupWizard.goToStep(stepNumber);

    // Update wizard state
    wizardState = await (window as any).electronAPI.setupWizard.getState();

    // Show step
    showStep(stepNumber);

    // Initialize step
    await initializeCurrentStep();

    // Update sidebar
    initializeSidebarSteps();
}

/**
 * Validate current step before proceeding
 */
async function validateCurrentStep(): Promise<boolean> {
    const result = await (window as any).electronAPI.setupWizard.canProceed(currentStep);

    if (!result.canProceed) {
        showError(result.reason || 'Cannot proceed to next step');
        return false;
    }

    return true;
}

/**
 * Cancel wizard
 */
function cancelWizard() {
    if (confirm('Are you sure you want to cancel the setup wizard? You can resume later from where you left off.')) {
        window.close();
    }
}

/**
 * Launch dashboard after completing wizard
 */
async function launchDashboard() {
    try {
        // Mark wizard as complete - main process will close wizard and open dashboard
        await (window as any).electronAPI.setupWizard.markComplete();

        // Window will be closed by main process after successful completion

    } catch (error) {
        console.error('Error launching dashboard:', error);
        showError('Failed to launch dashboard. Please restart the application.');
    }
}

/**
 * Utility functions
 */
function showError(message: string) {
    // You could implement a toast notification or modal here
    alert(message);
}

function showSuccessMessage(message: string, containerId: string) {
    const container = document.getElementById(containerId);
    if (container) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'alert success';
        messageDiv.innerHTML = `
            <span style="font-size: 1.5rem;">✓</span>
            <div>${message}</div>
        `;
        container.insertBefore(messageDiv, container.firstChild);
    }
}

function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
        showSuccessMessage('Copied to clipboard!', 'service-urls');
    }).catch(err => {
        console.error('Error copying to clipboard:', err);
        showError('Failed to copy to clipboard');
    });
}

function openBrowser(url: string) {
    window.open(url, '_blank');
}

// Assign functions to window for use in HTML event handlers
(window as any).checkPrerequisites = checkPrerequisites;
(window as any).nextStep = nextStep;
(window as any).previousStep = previousStep;
(window as any).goToStep = goToStep;
(window as any).cancelWizard = cancelWizard;
(window as any).copyToClipboard = copyToClipboard;
(window as any).openBrowser = openBrowser;
(window as any).initializeDownloadStep = initializeDownloadStep;
(window as any).initializeSystemStartupStep = initializeSystemStartupStep;

console.log('Setup wizard handlers loaded successfully');
