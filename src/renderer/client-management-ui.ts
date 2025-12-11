/**
 * Shared Client Management UI Logic
 * Used by both Setup Wizard and Dashboard
 */

/**
 * Shared Client Management UI Logic
 * Used by both Setup Wizard and Dashboard
 */

// Interface for the global object (internal use)
interface ClientManagementUI {
    createClientSelectionCards: (clients: any[], selectedClients: string[]) => string;
    setupClientSelectionListeners: (onRefresh: () => Promise<void>, onSaveSelection?: () => Promise<void>) => void;
    showClientModal: (clientId?: string) => Promise<void>;
}


/**
 * Create client selection cards HTML
 */
function createClientSelectionCards(clients: any[], selectedClients: string[]): string {
    let html = '<div class="client-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">';
    
    clients.forEach(client => {
        const isSelected = selectedClients.includes(client.id);
        const isCustom = client.isCustom;
        
        const clientTypeIcon = client.type === 'web-based' ? '🌐' : (client.type === 'electron-app' ? '⚡' : '💻');
        const clientTypeLabel = client.type === 'web-based' ? 'Web Application' : (client.type === 'electron-app' ? 'Electron Application' : 'Desktop Application');

        html += `
        <div class="prereq-card ${isSelected ? 'success' : ''}" data-client-id="${client.id}" style="position: relative;">
            <div class="prereq-header">
                <div class="prereq-icon">${clientTypeIcon}</div>
                <div style="flex: 1;">
                    <div class="prereq-title">${client.name}</div>
                    <div class="prereq-status">${clientTypeLabel}</div>
                </div>
                <div class="client-actions" style="display: flex; gap: 5px;">
                    ${client.type === 'electron-app' && client.executablePath ? `
                    <button class="icon-btn launch-client-btn" data-id="${client.id}" title="Launch Application" style="background: none; border: none; cursor: pointer; color: #4CAF50; font-size: 1.2rem;">
                        ▶️
                    </button>
                    ` : ''}
                    <button class="icon-btn edit-client-btn" data-id="${client.id}" title="Edit Configuration" style="background: none; border: none; cursor: pointer; color: #aaa;">
                        ✏️
                    </button>
                    ${isCustom ? `
                    <button class="icon-btn remove-client-btn" data-id="${client.id}" title="Remove Client" style="background: none; border: none; cursor: pointer; color: #aaa;">
                        🗑️
                    </button>
                    ` : ''}
                </div>
            </div>
            
            <div class="client-details" style="margin: 15px 0; font-size: 0.9rem; color: #ccc;">
                <p>${client.description}</p>
                ${client.repoUrl ? `<p style="margin-top: 5px; font-size: 0.8rem; color: #888;">Repo: ${client.repoUrl}</p>` : ''}
                ${client.dependencies && client.dependencies.length > 0 ? `<p style="margin-top: 5px; font-size: 0.8rem; color: #888;">Depends on: ${client.dependencies.join(', ')}</p>` : ''}
                <ul style="margin-top: 10px; padding-left: 20px;">
                    ${client.features.slice(0, 3).map((f: string) => `<li>${f}</li>`).join('')}
                </ul>
            </div>

            <div class="client-selection-toggle">
                <label class="switch">
                    <input type="checkbox" class="client-checkbox" value="${client.id}" ${isSelected ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
                <span style="margin-left: 10px;">${isSelected ? 'Selected' : 'Not Selected'}</span>
            </div>
        </div>
        `;
    });

    // Add "Add Custom Client" card
    html += `
        <div class="prereq-card dashed-border" id="add-custom-client-card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; min-height: 200px; border: 2px dashed rgba(255, 255, 255, 0.2);">
            <div style="font-size: 2rem; margin-bottom: 10px;">➕</div>
            <div style="font-weight: 500;">Add Custom Client</div>
            <div style="font-size: 0.8rem; color: #888; margin-top: 5px;">Configure a new repo to clone</div>
        </div>
    `;

    html += '</div>';
    
    // Add modal container if it doesn't exist
    if (!document.getElementById('client-modal')) {
        html += `
            <div id="client-modal" class="modal" style="display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.7);">
                <div class="modal-content" style="background-color: #1e1e1e; margin: 10% auto; padding: 20px; border: 1px solid #333; width: 500px; border-radius: 10px; color: #fff;">
                    <h2 id="modal-title" style="margin-top: 0;">Add Custom Client</h2>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">Name</label>
                        <input type="text" id="client-name-input" style="width: 100%; padding: 8px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">Type</label>
                        <select id="client-type-input" style="width: 100%; padding: 8px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px;">
                            <option value="web-based">Web Application</option>
                            <option value="electron-app">Electron Application</option>
                            <option value="native">Native Desktop Application</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">Repository URL</label>
                        <input type="text" id="client-repo-input" style="width: 100%; padding: 8px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 15px;" id="executable-path-container">
                        <label style="display: block; margin-bottom: 5px;">Executable Path (for Electron apps)</label>
                        <input type="text" id="client-exec-input" placeholder="e.g. /Applications/BQ-Studio.app or C:\Program Files\BQ-Studio\BQ-Studio.exe" style="width: 100%; padding: 8px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">Dependencies (comma separated IDs)</label>
                        <input type="text" id="client-deps-input" placeholder="e.g. fictionlab-mcp-servers" style="width: 100%; padding: 8px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">Description</label>
                        <textarea id="client-desc-input" style="width: 100%; padding: 8px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px; height: 60px;"></textarea>
                    </div>
                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                        <button id="modal-cancel-btn" class="wizard-btn secondary">Cancel</button>
                        <button id="modal-save-btn" class="wizard-btn primary">Save</button>
                    </div>
                </div>
            </div>
        `;
    }

    return html;
}

/**
 * Setup client selection listeners
 */
function setupClientSelectionListeners(
    onRefresh: () => Promise<void>, 
    onSaveSelection?: () => Promise<void>,
    container: HTMLElement | Document = document
) {
    // Checkbox listeners
    container.querySelectorAll('.client-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const target = e.target as HTMLInputElement;
            const card = target.closest('.prereq-card');
            const statusSpan = target.parentElement?.nextElementSibling;
            
            if (target.checked) {
                card?.classList.add('success');
                if (statusSpan) statusSpan.textContent = 'Selected';
            } else {
                card?.classList.remove('success');
                if (statusSpan) statusSpan.textContent = 'Not Selected';
            }
            
            if (onSaveSelection) {
                await onSaveSelection();
            }
        });
    });

    // Add Custom Client button
    const addBtn = (container as any).getElementById ? (container as any).getElementById('add-custom-client-card') : (container as HTMLElement).querySelector('#add-custom-client-card');
    if (addBtn) {
        addBtn.addEventListener('click', () => showClientModal());
    }

    // Launch buttons
    container.querySelectorAll('.launch-client-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const clientId = (e.currentTarget as HTMLElement).getAttribute('data-id');
            if (clientId) {
                const button = e.currentTarget as HTMLButtonElement;
                const originalContent = button.innerHTML;
                button.innerHTML = '⏳';
                button.disabled = true;

                try {
                    const result = await (window as any).electronAPI.clientSelection.launchElectronApp(clientId);
                    if (result.success) {
                        button.innerHTML = '✅';
                        setTimeout(() => {
                            button.innerHTML = originalContent;
                            button.disabled = false;
                        }, 2000);
                    } else {
                        button.innerHTML = '❌';
                        alert(`Failed to launch application: ${result.error}`);
                        setTimeout(() => {
                            button.innerHTML = originalContent;
                            button.disabled = false;
                        }, 2000);
                    }
                } catch (error) {
                    button.innerHTML = '❌';
                    alert(`Error launching application: ${error}`);
                    setTimeout(() => {
                        button.innerHTML = originalContent;
                        button.disabled = false;
                    }, 2000);
                }
            }
        });
    });

    // Edit buttons
    container.querySelectorAll('.edit-client-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const clientId = (e.currentTarget as HTMLElement).getAttribute('data-id');
            if (clientId) showClientModal(clientId);
        });
    });

    // Remove buttons
    container.querySelectorAll('.remove-client-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const clientId = (e.currentTarget as HTMLElement).getAttribute('data-id');
            if (clientId && confirm('Are you sure you want to remove this client?')) {
                await (window as any).electronAPI.clientSelection.removeCustomClient(clientId);
                await onRefresh();
            }
        });
    });

    // Modal listeners (these are always global/document level as modals are appended to body)
    const modal = document.getElementById('client-modal');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const saveBtn = document.getElementById('modal-save-btn');

    // Remove existing listeners to avoid duplicates
    if (cancelBtn) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode?.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', () => {
            if (modal) modal.style.display = 'none';
        });
    }

    if (saveBtn) {
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode?.replaceChild(newSaveBtn, saveBtn);
        newSaveBtn.addEventListener('click', async () => {
            await handleSaveClient(onRefresh);
        });
    }
}

/**
 * Show Client Manager Modal (for Dashboard)
 */
async function showClientManager() {
    let managerModal = document.getElementById('client-manager-modal');
    
    if (!managerModal) {
        const modalHtml = `
            <div id="client-manager-modal" class="modal" style="display: none; position: fixed; z-index: 999; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.8);">
                <div class="modal-content" style="background-color: #1e1e1e; margin: 5% auto; padding: 20px; border: 1px solid #333; width: 80%; max-width: 1000px; max-height: 90vh; overflow-y: auto; border-radius: 10px; color: #fff;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2 style="margin: 0;">Manage Clients</h2>
                        <button id="client-manager-close-btn" style="background: none; border: none; color: #aaa; font-size: 1.5rem; cursor: pointer;">&times;</button>
                    </div>
                    <div id="client-manager-content">
                        Loading...
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        managerModal = document.getElementById('client-manager-modal');
        
        // Close button listener
        const closeBtn = document.getElementById('client-manager-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (managerModal) managerModal.style.display = 'none';
                // Trigger dashboard update when closing, just in case
                const event = new CustomEvent('clients-updated');
                window.dispatchEvent(event);
            });
        }
    }

    if (!managerModal) return;

    const contentContainer = document.getElementById('client-manager-content');
    if (!contentContainer) return;

    // Refresh function
    const refreshManager = async () => {
        try {
            const clients = await (window as any).electronAPI.clientSelection.getOptions();
            const selection = await (window as any).electronAPI.clientSelection.getSelection();
            const selectedClients = selection?.clients || [];
            
            contentContainer.innerHTML = createClientSelectionCards(clients, selectedClients);
            
            setupClientSelectionListeners(
                refreshManager, // onRefresh
                async () => {
                    // onSaveSelection
                    const selected: string[] = [];
                    contentContainer.querySelectorAll('.client-checkbox:checked').forEach((checkbox: any) => {
                        selected.push(checkbox.value);
                    });
                    await (window as any).electronAPI.clientSelection.saveSelection(selected);
                },
                contentContainer // Scope listeners to this container
            );
        } catch (error) {
            console.error('Error refreshing client manager:', error);
            contentContainer.innerHTML = `<div style="color: #ff6b6b;">Error loading clients: ${error}</div>`;
        }
    };

    managerModal.style.display = 'block';
    await refreshManager();
}

/**
 * Show client modal (for adding or editing)
 */
async function showClientModal(clientId?: string) {
    const modal = document.getElementById('client-modal');
    const title = document.getElementById('modal-title');
    const nameInput = document.getElementById('client-name-input') as HTMLInputElement;
    const typeInput = document.getElementById('client-type-input') as HTMLSelectElement;
    const repoInput = document.getElementById('client-repo-input') as HTMLInputElement;
    const execInput = document.getElementById('client-exec-input') as HTMLInputElement;
    const depsInput = document.getElementById('client-deps-input') as HTMLInputElement;
    const descInput = document.getElementById('client-desc-input') as HTMLTextAreaElement;
    const saveBtn = document.getElementById('modal-save-btn');

    if (!modal || !title || !nameInput || !typeInput || !repoInput || !execInput || !depsInput || !descInput || !saveBtn) return;

    // Set up type change handler to show/hide executable path field
    const updateExecutablePathVisibility = () => {
        const execContainer = document.getElementById('executable-path-container');
        if (execContainer) {
            execContainer.style.display = typeInput.value === 'electron-app' ? 'block' : 'none';
        }
    };

    typeInput.removeEventListener('change', updateExecutablePathVisibility);
    typeInput.addEventListener('change', updateExecutablePathVisibility);

    if (clientId) {
        // Edit mode
        title.textContent = 'Edit Client Configuration';
        const client = await (window as any).electronAPI.clientSelection.getById(clientId);
        if (client) {
            nameInput.value = client.name;
            nameInput.disabled = !client.isCustom; // Can't rename default clients
            typeInput.value = client.type || 'web-based';
            typeInput.disabled = !client.isCustom; // Can't change type of default clients
            repoInput.value = client.repoUrl || '';
            execInput.value = client.executablePath || '';
            depsInput.value = client.dependencies ? client.dependencies.join(', ') : '';
            descInput.value = client.description;
            descInput.disabled = !client.isCustom; // Can't change description of default clients
            saveBtn.setAttribute('data-id', clientId);
        }
    } else {
        // Add mode
        title.textContent = 'Add Custom Client';
        nameInput.value = '';
        nameInput.disabled = false;
        typeInput.value = 'web-based';
        typeInput.disabled = false;
        repoInput.value = '';
        execInput.value = '';
        depsInput.value = '';
        descInput.value = '';
        descInput.disabled = false;
        saveBtn.removeAttribute('data-id');
    }

    updateExecutablePathVisibility();
    modal.style.display = 'block';
}

/**
 * Handle saving client from modal
 */
async function handleSaveClient(onRefresh: () => Promise<void>) {
    const modal = document.getElementById('client-modal');
    const nameInput = document.getElementById('client-name-input') as HTMLInputElement;
    const typeInput = document.getElementById('client-type-input') as HTMLSelectElement;
    const repoInput = document.getElementById('client-repo-input') as HTMLInputElement;
    const execInput = document.getElementById('client-exec-input') as HTMLInputElement;
    const depsInput = document.getElementById('client-deps-input') as HTMLInputElement;
    const descInput = document.getElementById('client-desc-input') as HTMLTextAreaElement;
    const saveBtn = document.getElementById('modal-save-btn');

    if (!modal || !nameInput || !typeInput || !repoInput || !execInput || !depsInput || !descInput || !saveBtn) return;

    const clientId = saveBtn.getAttribute('data-id');
    const name = nameInput.value.trim();
    const type = typeInput.value as 'web-based' | 'native' | 'electron-app';
    const repoUrl = repoInput.value.trim();
    const executablePath = execInput.value.trim();
    const description = descInput.value.trim();
    const dependencies = depsInput.value.split(',').map(d => d.trim()).filter(d => d.length > 0);

    // Validation
    if (type === 'electron-app' && !executablePath) {
        alert('Executable path is required for Electron applications');
        return;
    }

    try {
        if (clientId) {
            // Update existing
            const updates: any = {
                repoUrl,
                dependencies,
                executablePath: type === 'electron-app' ? executablePath : undefined,
                ...(nameInput.disabled ? {} : { name }),
                ...(typeInput.disabled ? {} : { type }),
                ...(descInput.disabled ? {} : { description })
            };
            await (window as any).electronAPI.clientSelection.updateClientConfig(clientId, updates);
        } else {
            // Add new
            if (!name) {
                alert('Name is required');
                return;
            }

            const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
            await (window as any).electronAPI.clientSelection.addCustomClient({
                id,
                name,
                type,
                description,
                features: ['Custom Client'],
                requirements: [],
                downloadSize: 'Unknown',
                installation: 'automatic',
                repoUrl,
                executablePath: type === 'electron-app' ? executablePath : undefined,
                dependencies,
                isCustom: true
            });
        }

        modal.style.display = 'none';
        await onRefresh();
    } catch (error) {
        console.error('Error saving client:', error);
        alert('Failed to save client: ' + (error instanceof Error ? error.message : String(error)));
    }
}

// Expose to window
(window as any).ClientManagementUI = {
    createClientSelectionCards,
    setupClientSelectionListeners,
    showClientModal,
    showClientManager
};
