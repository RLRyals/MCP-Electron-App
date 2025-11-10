/**
 * Migration Wizard Renderer Logic
 * Handles the migration wizard UI and user interactions
 */

// Wrap in IIFE to avoid global scope conflicts
(function() {
'use strict';

// Migration wizard state
let currentMigrationStep = 'review'; // 'review', 'running', 'complete'
let pendingMigrations: any = null;
let migrationResults: any[] = [];
let currentMigrationIndex = 0;

/**
 * Initialize the migration wizard on page load
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Migration wizard initializing...');

    try {
        // Check for pending migrations
        pendingMigrations = await (window as any).electronAPI.migrations.checkPending();
        console.log('Pending migrations:', pendingMigrations);

        // Display migration summary
        displayMigrationSummary();

        // Display migration lists
        displayMigrations();

        // Update version info
        updateVersionInfo();

        // Attach event listeners
        attachEventListeners();
    } catch (error) {
        console.error('Error initializing migration wizard:', error);
        showError('Failed to load migrations. Please restart the application.');
    }
});

/**
 * Attach event listeners to buttons
 */
function attachEventListeners() {
    const actionBtn = document.getElementById('action-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const retryBtn = document.getElementById('retry-btn');
    const skipBtn = document.getElementById('skip-btn');
    const toggleConsole = document.getElementById('toggle-console');

    if (actionBtn) {
        actionBtn.addEventListener('click', handleActionButton);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', handleCancel);
    }

    if (retryBtn) {
        retryBtn.addEventListener('click', retryCurrentMigration);
    }

    if (skipBtn) {
        skipBtn.addEventListener('click', skipCurrentMigration);
    }

    if (toggleConsole) {
        toggleConsole.addEventListener('click', toggleConsoleOutput);
    }
}

/**
 * Display migration summary statistics
 */
function displayMigrationSummary() {
    const criticalCountEl = document.getElementById('critical-count');
    const optionalCountEl = document.getElementById('optional-count');

    if (criticalCountEl) {
        criticalCountEl.textContent = pendingMigrations.criticalCount.toString();
    }

    if (optionalCountEl) {
        optionalCountEl.textContent = pendingMigrations.optionalCount.toString();
    }
}

/**
 * Display migrations grouped by criticality
 */
function displayMigrations() {
    const criticalSection = document.getElementById('critical-migrations');
    const optionalSection = document.getElementById('optional-migrations');

    const criticalMigrations = pendingMigrations.migrations.filter((m: any) => m.critical);
    const optionalMigrations = pendingMigrations.migrations.filter((m: any) => !m.critical);

    if (criticalMigrations.length > 0 && criticalSection) {
        criticalSection.innerHTML = `
            <h3 class="section-title critical">
                <span class="title-icon">⚠️</span>
                Critical Updates (Must be applied)
            </h3>
            <div class="migrations-list">
                ${criticalMigrations.map((m: any) => createMigrationCard(m, true)).join('')}
            </div>
        `;
    }

    if (optionalMigrations.length > 0 && optionalSection) {
        optionalSection.innerHTML = `
            <h3 class="section-title optional">
                <span class="title-icon">ℹ️</span>
                Optional Updates
            </h3>
            <div class="migrations-list">
                ${optionalMigrations.map((m: any) => createMigrationCard(m, false)).join('')}
            </div>
        `;
    }
}

/**
 * Create a migration card HTML
 */
function createMigrationCard(migration: any, isCritical: boolean): string {
    const stepsText = migration.steps && migration.steps.length > 0
        ? `Will rerun ${migration.steps.length} setup step${migration.steps.length !== 1 ? 's' : ''}`
        : 'No steps to rerun';

    return `
        <div class="migration-card ${isCritical ? 'critical' : 'optional'}">
            <div class="migration-header">
                <div class="migration-version">
                    <span class="version-badge">v${migration.version}</span>
                    ${isCritical ? '<span class="critical-badge">Critical</span>' : ''}
                </div>
            </div>
            <div class="migration-description">${migration.description}</div>
            <div class="migration-meta">
                <span class="meta-item">
                    <span class="meta-icon">🔧</span>
                    ${stepsText}
                </span>
                ${migration.fromVersion ? `
                    <span class="meta-item">
                        <span class="meta-icon">📦</span>
                        From v${migration.fromVersion}
                    </span>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Update version information in footer
 */
async function updateVersionInfo() {
    const versionInfoEl = document.getElementById('version-info');

    if (versionInfoEl) {
        try {
            const appVersion = await (window as any).electronAPI.getAppVersion();
            versionInfoEl.textContent = `Current version: ${appVersion}`;
        } catch (error) {
            console.error('Failed to get app version:', error);
        }
    }
}

/**
 * Handle action button click (changes based on current step)
 */
async function handleActionButton() {
    const actionBtn = document.getElementById('action-btn') as HTMLButtonElement;

    if (!actionBtn) return;

    if (currentMigrationStep === 'review') {
        // Start migrations
        await startMigrations();
    } else if (currentMigrationStep === 'complete') {
        // Continue to main app
        await continueToApp();
    }
}

/**
 * Start running migrations
 */
async function startMigrations() {
    console.log('Starting migrations...');

    // Switch to running step
    switchToStep('running');

    // Disable action button
    const actionBtn = document.getElementById('action-btn') as HTMLButtonElement;
    if (actionBtn) {
        actionBtn.disabled = true;
    }

    try {
        // Run migrations
        migrationResults = await runMigrationsSequentially(pendingMigrations.migrations);

        // Check if all succeeded
        const allSucceeded = migrationResults.every((r: any) => r.success);

        if (allSucceeded) {
            console.log('All migrations completed successfully');
            switchToStep('complete');
            displayResults(migrationResults);
        } else {
            console.error('Some migrations failed');
            const failedMigration = migrationResults.find((r: any) => !r.success);
            showError(`Migration v${failedMigration.version} failed: ${failedMigration.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error running migrations:', error);
        showError(`Failed to run migrations: ${error}`);
    } finally {
        // Re-enable action button
        if (actionBtn) {
            actionBtn.disabled = false;
        }
    }
}

/**
 * Run migrations sequentially with progress updates
 */
async function runMigrationsSequentially(migrations: any[]): Promise<any[]> {
    const results: any[] = [];
    const progressEl = document.getElementById('migrations-progress');

    if (!progressEl) return results;

    // Clear previous progress items
    progressEl.innerHTML = '';

    for (let i = 0; i < migrations.length; i++) {
        const migration = migrations[i];
        currentMigrationIndex = i;

        // Update overall progress
        const percent = Math.round(((i) / migrations.length) * 100);
        updateOverallProgress(percent, `Applying migration v${migration.version}...`);

        // Add progress item
        const progressItem = createProgressItem(migration, i);
        progressEl.appendChild(progressItem);

        // Scroll to show current item
        progressItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        try {
            // Update progress item to running
            updateProgressItem(i, 'running');

            // Log to console
            logToConsole(`Starting migration v${migration.version}: ${migration.description}`);

            // Run the migration
            const result = await (window as any).electronAPI.migrations.run([migration]);

            if (result && result.length > 0) {
                const migrationResult = result[0];
                results.push(migrationResult);

                if (migrationResult.success) {
                    // Update progress item to complete
                    updateProgressItem(i, 'complete');
                    logToConsole(`✓ Migration v${migration.version} completed successfully`);
                } else {
                    // Update progress item to error
                    updateProgressItem(i, 'error', migrationResult.error);
                    logToConsole(`✗ Migration v${migration.version} failed: ${migrationResult.error}`, true);

                    // Stop on critical migration failure
                    if (migration.critical) {
                        throw new Error(`Critical migration v${migration.version} failed: ${migrationResult.error}`);
                    }
                }
            }
        } catch (error) {
            console.error(`Migration v${migration.version} failed:`, error);
            updateProgressItem(i, 'error', String(error));
            logToConsole(`✗ Migration v${migration.version} failed: ${error}`, true);

            results.push({
                version: migration.version,
                success: false,
                error: String(error),
                appliedAt: new Date().toISOString(),
                stepsRerun: []
            });

            // Stop on critical migration failure
            if (migration.critical) {
                throw error;
            }
        }
    }

    // Update to 100%
    updateOverallProgress(100, 'All migrations completed');

    return results;
}

/**
 * Create a progress item element
 */
function createProgressItem(migration: any, index: number): HTMLElement {
    const div = document.createElement('div');
    div.className = 'migration-progress-item pending';
    div.id = `migration-progress-${index}`;
    div.innerHTML = `
        <div class="progress-item-header">
            <span class="progress-status-icon">⏳</span>
            <span class="progress-version">v${migration.version}</span>
            <span class="progress-status">Pending</span>
        </div>
        <div class="progress-item-description">${migration.description}</div>
        <div class="progress-item-error" style="display: none;"></div>
    `;
    return div;
}

/**
 * Update a progress item's status
 */
function updateProgressItem(index: number, status: 'pending' | 'running' | 'complete' | 'error', errorMessage?: string) {
    const item = document.getElementById(`migration-progress-${index}`);
    if (!item) return;

    const icon = item.querySelector('.progress-status-icon');
    const statusText = item.querySelector('.progress-status');
    const errorDiv = item.querySelector('.progress-item-error') as HTMLElement;

    // Remove all status classes
    item.classList.remove('pending', 'running', 'complete', 'error');
    item.classList.add(status);

    switch (status) {
        case 'running':
            if (icon) icon.textContent = '⏳';
            if (statusText) statusText.textContent = 'Running...';
            break;
        case 'complete':
            if (icon) icon.textContent = '✅';
            if (statusText) statusText.textContent = 'Complete';
            break;
        case 'error':
            if (icon) icon.textContent = '❌';
            if (statusText) statusText.textContent = 'Failed';
            if (errorDiv && errorMessage) {
                errorDiv.textContent = errorMessage;
                errorDiv.style.display = 'block';
            }
            break;
        default:
            if (icon) icon.textContent = '⏳';
            if (statusText) statusText.textContent = 'Pending';
    }
}

/**
 * Update overall progress bar
 */
function updateOverallProgress(percent: number, message: string) {
    const percentEl = document.getElementById('overall-percent');
    const fillEl = document.getElementById('overall-progress-fill');
    const operationEl = document.getElementById('current-operation');

    if (percentEl) {
        percentEl.textContent = `${percent}%`;
    }

    if (fillEl) {
        (fillEl as HTMLElement).style.width = `${percent}%`;
    }

    if (operationEl) {
        operationEl.textContent = message;
    }
}

/**
 * Log message to console output
 */
function logToConsole(message: string, isError: boolean = false) {
    const consoleOutput = document.getElementById('console-output');
    if (!consoleOutput) return;

    // Remove placeholder if exists
    const placeholder = consoleOutput.querySelector('.console-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    const logLine = document.createElement('div');
    logLine.className = isError ? 'console-line error' : 'console-line';
    logLine.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;

    consoleOutput.appendChild(logLine);

    // Auto-scroll to bottom
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

/**
 * Toggle console output visibility
 */
function toggleConsoleOutput() {
    const consoleOutput = document.getElementById('console-output');
    const toggleText = document.getElementById('console-toggle-text');

    if (!consoleOutput || !toggleText) return;

    if (consoleOutput.classList.contains('collapsed')) {
        consoleOutput.classList.remove('collapsed');
        toggleText.textContent = 'Hide Details';
    } else {
        consoleOutput.classList.add('collapsed');
        toggleText.textContent = 'Show Details';
    }
}

/**
 * Display migration results on completion step
 */
function displayResults(results: any[]) {
    const resultsContainer = document.getElementById('migration-results');
    if (!resultsContainer) return;

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    resultsContainer.innerHTML = `
        <div class="results-summary">
            <div class="result-stat success">
                <div class="result-icon">✅</div>
                <div class="result-info">
                    <div class="result-value">${successCount}</div>
                    <div class="result-label">Successful</div>
                </div>
            </div>
            ${failureCount > 0 ? `
                <div class="result-stat error">
                    <div class="result-icon">❌</div>
                    <div class="result-info">
                        <div class="result-value">${failureCount}</div>
                        <div class="result-label">Failed</div>
                    </div>
                </div>
            ` : ''}
        </div>

        <div class="results-list">
            ${results.map(result => `
                <div class="result-item ${result.success ? 'success' : 'error'}">
                    <div class="result-header">
                        <span class="result-status-icon">${result.success ? '✅' : '❌'}</span>
                        <span class="result-version">v${result.version}</span>
                        <span class="result-status">${result.success ? 'Success' : 'Failed'}</span>
                    </div>
                    ${!result.success && result.error ? `
                        <div class="result-error">${result.error}</div>
                    ` : ''}
                    ${result.stepsRerun && result.stepsRerun.length > 0 ? `
                        <div class="result-steps">Reran ${result.stepsRerun.length} setup step${result.stepsRerun.length !== 1 ? 's' : ''}</div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Switch to a different migration step
 */
function switchToStep(step: 'review' | 'running' | 'complete') {
    currentMigrationStep = step;

    // Hide all steps
    const steps = document.querySelectorAll('.migration-step');
    steps.forEach(s => s.classList.remove('active'));

    // Show target step
    const targetStep = document.getElementById(`${step}-step`);
    if (targetStep) {
        targetStep.classList.add('active');
    }

    // Update action button
    const actionBtn = document.getElementById('action-btn') as HTMLButtonElement;
    const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;

    if (actionBtn) {
        switch (step) {
            case 'review':
                actionBtn.textContent = 'Apply Updates';
                actionBtn.disabled = false;
                break;
            case 'running':
                actionBtn.textContent = 'Please Wait...';
                actionBtn.disabled = true;
                break;
            case 'complete':
                actionBtn.textContent = 'Continue';
                actionBtn.disabled = false;
                break;
        }
    }

    if (cancelBtn) {
        // Only allow cancel on review step
        cancelBtn.style.display = step === 'review' ? 'block' : 'none';
    }
}

/**
 * Retry current migration
 */
async function retryCurrentMigration() {
    hideError();

    const migration = pendingMigrations.migrations[currentMigrationIndex];
    if (!migration) return;

    // Retry the migration
    try {
        logToConsole(`Retrying migration v${migration.version}...`);
        updateProgressItem(currentMigrationIndex, 'running');

        const result = await (window as any).electronAPI.migrations.run([migration]);

        if (result && result.length > 0 && result[0].success) {
            updateProgressItem(currentMigrationIndex, 'complete');
            logToConsole(`✓ Migration v${migration.version} completed successfully`);

            // Continue with remaining migrations
            // Note: This is simplified - in a real implementation,
            // you'd want to continue the sequence from where it failed
        } else {
            const error = result && result.length > 0 ? result[0].error : 'Unknown error';
            updateProgressItem(currentMigrationIndex, 'error', error);
            logToConsole(`✗ Migration v${migration.version} failed: ${error}`, true);
            showError(`Migration v${migration.version} failed: ${error}`);
        }
    } catch (error) {
        updateProgressItem(currentMigrationIndex, 'error', String(error));
        logToConsole(`✗ Migration v${migration.version} failed: ${error}`, true);
        showError(`Migration v${migration.version} failed: ${error}`);
    }
}

/**
 * Skip current migration
 */
function skipCurrentMigration() {
    hideError();

    const migration = pendingMigrations.migrations[currentMigrationIndex];
    if (!migration) return;

    if (migration.critical) {
        showError('Cannot skip critical migrations. Please retry or contact support.');
        return;
    }

    logToConsole(`Skipping migration v${migration.version}`);
    updateProgressItem(currentMigrationIndex, 'error', 'Skipped by user');

    // Continue with next migration
    // Note: This is simplified - actual implementation would resume the sequence
}

/**
 * Show error message
 */
function showError(message: string) {
    const errorDisplay = document.getElementById('error-display');
    const errorMessage = document.getElementById('error-message');

    if (errorDisplay && errorMessage) {
        errorMessage.textContent = message;
        errorDisplay.style.display = 'block';
    }
}

/**
 * Hide error message
 */
function hideError() {
    const errorDisplay = document.getElementById('error-display');
    if (errorDisplay) {
        errorDisplay.style.display = 'none';
    }
}

/**
 * Handle cancel button
 */
async function handleCancel() {
    const confirm = await showConfirmDialog(
        'Cancel Updates',
        'Are you sure you want to cancel? The application may not work correctly without these updates.'
    );

    if (confirm) {
        // Close window and exit
        (window as any).electronAPI.closeWindow();
    }
}

/**
 * Continue to main app after successful migration
 */
async function continueToApp() {
    console.log('Continuing to main app...');

    try {
        // Notify main process that migrations are complete
        await (window as any).electronAPI.migrations.complete();

        // Close migration window
        (window as any).electronAPI.closeWindow();
    } catch (error) {
        console.error('Error continuing to app:', error);
        showError('Failed to continue. Please restart the application.');
    }
}

/**
 * Show confirmation dialog (simple implementation)
 */
async function showConfirmDialog(title: string, message: string): Promise<boolean> {
    return confirm(`${title}\n\n${message}`);
}

})(); // End IIFE
