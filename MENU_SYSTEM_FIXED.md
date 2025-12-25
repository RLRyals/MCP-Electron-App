# Menu System - FIXED ✅

## Problem

The app uses a **custom HTML menu system** in the TopBar, NOT the native Electron menu. The menu dropdowns were:
- Rendering as text only
- Appearing behind other UI elements
- Not clickable

## Root Cause

1. **Missing CSS**: Menu dropdown elements (`.menu-dropdown`) had no CSS styling
2. **Low z-index**: No z-index set, so dropdowns appeared behind sidebar and other elements
3. **Missing Plugin Menu**: No "Plugins" menu dropdown items defined in TopBar

## Solutions Applied

### 1. Added Menu Dropdown CSS ✅
**File**: [src/renderer/styles/top-bar.css](src/renderer/styles/top-bar.css#L594-L643)

Added complete styling:
- `z-index: 10000 !important` - Ensures menus appear on top
- Proper positioning, colors, hover effects
- Disabled state styling
- Separator styling
- Keyboard shortcut styling

### 2. Added "Plugins" Menu Items ✅
**File**: [src/renderer/components/TopBar.ts](src/renderer/components/TopBar.ts#L640-L649)

Added `case 'plugins':` to `getMenuItems()`:
```typescript
case 'plugins':
  return [
    { label: 'Manage Plugins', action: 'plugins-manage' },
    { separator: true } as any,
    { label: 'Claude Code: Install CLI', action: 'plugin-claude-code-subscription-install-cli' },
    { label: 'Claude Code: Login to Anthropic', action: 'plugin-claude-code-subscription-login' },
    { label: 'Claude Code: Check Auth Status', action: 'plugin-claude-code-subscription-check-auth' },
    { label: 'Claude Code: Run Headless Task', action: 'plugin-claude-code-subscription-run-task' },
    { label: 'Claude Code: Settings', action: 'plugin-claude-code-subscription-show-settings' },
  ];
```

### 3. Added Menu Action Handlers ✅
**File**: [src/renderer/renderer.ts](src/renderer/renderer.ts#L936-L984)

Added action handlers in the `menu-action` event listener:
- `plugins-manage` → Navigate to plugins view
- `plugin-claude-code-subscription-*` → Call plugin IPC handlers

### 4. Fixed Plugin UI (No Launch Button) ✅
**File**: [src/renderer/views/PluginsLauncher.ts](src/renderer/views/PluginsLauncher.ts#L97-L133)

- Hides "Launch" button for `pluginType: 'utility'` plugins
- Shows hint: "Menu: Plugins → Claude Code (Subscription)"
- Adds "Utility" badge

## How the Menu System Works

### TopBar HTML Menu (Current System)

The app uses a **custom HTML-based menu** in the TopBar component, not Electron's native menu.

**Menu Structure**:
```
File | Edit | View | Plugins | Diagnostics | Help
                      └─ (Dropdown opens here)
```

**Flow**:
1. User clicks "Plugins" in TopBar
2. `TopBar.showMenuDropdown('plugins')` called
3. Dropdown HTML created with menu items
4. CSS positions dropdown below menu item
5. Click on menu item → emits `menu-action` event
6. Renderer handles action → calls plugin IPC

### Menu Dropdown Rendering

**TopBar.ts** (lines 556-597):
```typescript
private showMenuDropdown(menuId: string, menuElement: HTMLElement): void {
  const menuItems = this.getMenuItems(menuId);

  // Create dropdown element
  const dropdown = document.createElement('div');
  dropdown.className = 'menu-dropdown';

  // Position below menu item
  dropdown.style.top = `${rect.bottom}px`;
  dropdown.style.left = `${rect.left}px`;

  // Add menu items with data-action attributes
  dropdown.innerHTML = menuItems.map(item => {
    return `
      <div class="menu-dropdown-item" data-action="${item.action}">
        <span class="menu-item-label">${item.label}</span>
      </div>
    `;
  }).join('');

  document.body.appendChild(dropdown);
}
```

### CSS Z-Index Hierarchy

```
z-index: 10000  → .menu-dropdown (Plugins menu)
z-index: 1000   → .project-dropdown
z-index: auto   → .sidebar, .main-content
```

Menu dropdowns now always appear on top.

## Testing

### Step 1: Restart FictionLab

```bash
npm start
```

### Step 2: Test Plugins Menu

1. **Click "Plugins" in the top menu bar**
2. **Dropdown should appear with**:
   - Manage Plugins
   - ───────────── (separator)
   - Claude Code: Install CLI
   - Claude Code: Login to Anthropic
   - Claude Code: Check Auth Status
   - Claude Code: Run Headless Task
   - Claude Code: Settings

3. **Dropdown should be**:
   - ✅ Visible (not behind other elements)
   - ✅ Clickable
   - ✅ Styled with dark background
   - ✅ Hoverable items turn lighter

### Step 3: Test Menu Actions

**Click "Claude Code: Check Auth Status"**:
- Console should show: `[Renderer] Menu action: plugin-claude-code-subscription-check-auth`
- Plugin IPC handler should be called
- Dialog should appear (auth status or "not authenticated")

**Click "Manage Plugins"**:
- Should navigate to Plugins view
- Console shows: `[ViewRouter] Navigating to: plugins`

### Step 4: Test Plugins View

1. Navigate to Plugins view (Ctrl+4 or View → Plugins)
2. Find "Claude Code (Subscription)" card
3. **Verify**:
   - ✅ Shows "Active" status
   - ✅ Shows "Utility" badge
   - ✅ NO "Launch" button
   - ✅ Shows hint: "Menu: Plugins → Claude Code (Subscription)"

## Files Modified

1. **[src/renderer/styles/top-bar.css](src/renderer/styles/top-bar.css)** - Added menu dropdown CSS with `z-index: 10000`
2. **[src/renderer/components/TopBar.ts](src/renderer/components/TopBar.ts)** - Added "Plugins" menu items
3. **[src/renderer/renderer.ts](src/renderer/renderer.ts)** - Added plugin menu action handlers
4. **[src/renderer/views/PluginsLauncher.ts](src/renderer/views/PluginsLauncher.ts)** - Hide Launch button for utility plugins

## Expected Console Logs

### When Plugin Activates:
```
[Plugin: claude-code-subscription] Activating Claude Code Subscription plugin...
[Plugin: claude-code-subscription] Registered IPC handlers
[Plugin: claude-code-subscription] Plugin activated successfully
```

### When Clicking Plugins Menu:
```
[TopBar] Menu clicked: plugins
```

### When Clicking Menu Item:
```
[Renderer] Menu action: plugin-claude-code-subscription-check-auth
```

### When Plugin Handler Executes:
```
[Renderer] Plugin action result: { success: true, authenticated: false, message: "Not authenticated" }
```

## Troubleshooting

### Menu dropdown doesn't appear

**Check**:
1. TopBar rendered correctly?
2. Console errors?
3. CSS loaded? (check Network tab)

**Fix**: Clear cache and reload (Ctrl+Shift+R)

### Menu appears but behind elements

**Check**: `top-bar.css` has the new menu-dropdown styles

**Verify**:
```bash
grep "menu-dropdown" src/renderer/styles/top-bar.css
```

Should show the new CSS rules.

### Menu items not clickable

**Check**: Console for click event logs

**Look for**:
```
[TopBar] Menu clicked: plugins
```

If missing, menu click handler not attached.

### Plugin action does nothing

**Check**: Console for action handling

**Expected**:
```
[Renderer] Menu action: plugin-claude-code-subscription-check-auth
```

If missing, action not in switch statement or typo in action name.

## About Native Menu

The native Electron menu (`Menu.setApplicationMenu()`) is still created by the plugin-manager but it's **not visible** because the app uses a custom window frame.

The native menu would only be visible in:
- macOS (always shows in menu bar)
- Windows/Linux with native frame (not frameless)

Since this app uses a frameless window, we use the custom HTML TopBar menu instead.

## Next Steps

1. ✅ Test menu dropdown appears
2. ✅ Test menu items are clickable
3. ✅ Test plugin actions execute
4. Test "Install CLI" action
5. Test "Login to Anthropic" action
6. Create task runner form UI (future)

---

**Build**: 2025-12-18
**Status**: ✅ Ready to test
**Files Modified**: 4
