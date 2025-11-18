# Contributing to FictionLab App

Thank you for your interest in contributing to the FictionLab App! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Project Structure](#project-structure)
- [Common Tasks](#common-tasks)
- [Troubleshooting Development Issues](#troubleshooting-development-issues)

---

## Code of Conduct

### Our Pledge

We are committed to making participation in this project a harassment-free experience for everyone, regardless of level of experience, gender, gender identity and expression, sexual orientation, disability, personal appearance, body size, race, ethnicity, age, religion, or nationality.

### Our Standards

**Positive behavior:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior:**
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

---

## How Can I Contribute?

### Reporting Bugs

**Before submitting a bug report:**
1. Check the [existing issues](https://github.com/RLRyals/MCP-Electron-App/issues)
2. Check the [Troubleshooting Guide](TROUBLESHOOTING.md)
3. Try the latest version

**When submitting a bug report:**
1. Use the bug report issue template
2. Provide a clear and descriptive title
3. Describe the exact steps to reproduce
4. Provide specific examples
5. Describe the behavior you observed and what you expected
6. Include screenshots if relevant
7. Include your environment details (OS, app version, Docker version)
8. Attach diagnostic report (Help → Export Diagnostic Report)

### Suggesting Enhancements

**Before suggesting an enhancement:**
1. Check if it's already been suggested
2. Check if it's in the roadmap

**When suggesting an enhancement:**
1. Use the feature request issue template
2. Provide a clear and descriptive title
3. Explain why this enhancement would be useful
4. Provide examples of how it would work
5. Consider potential drawbacks

### Improving Documentation

Documentation improvements are always welcome!

**Areas to improve:**
- Fix typos or unclear explanations
- Add examples
- Improve organization
- Add translations (future)
- Write tutorials

Submit documentation changes via pull request.

### Contributing Code

See [Development Setup](#development-setup) and [Development Workflow](#development-workflow) below.

---

## Development Setup

### Prerequisites

**Required:**
- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **Git** for version control
- **Docker Desktop** (for testing)

**Platform-Specific:**

**Windows:**
- No additional requirements

**macOS:**
- Xcode Command Line Tools: `xcode-select --install`

**Linux:**
- Build tools: `sudo apt-get install build-essential`

### Fork and Clone

1. **Fork the repository** on GitHub
2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/MCP-Electron-App.git
   cd MCP-Electron-App
   ```
3. **Add upstream remote:**
   ```bash
   git remote add upstream https://github.com/RLRyals/MCP-Electron-App.git
   ```

### Install Dependencies

```bash
npm install
```

This installs:
- Electron
- TypeScript
- Electron Builder
- Type definitions
- Other dependencies

### Build TypeScript

```bash
# One-time build
npm run build

# Watch mode (auto-rebuild on changes)
npm run build:watch
```

**Output:** Compiled JavaScript in `dist/` directory

### Run the App

```bash
# Run in development mode with DevTools
npm run dev

# Or build first, then run
npm run build
npm start
```

**Development mode includes:**
- Developer Tools open by default
- Detailed logging
- Hot reload (with build:watch)

---

## Development Workflow

### 1. Create a Branch

```bash
# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/my-feature

# Or for bug fixes
git checkout -b fix/bug-description
```

**Branch naming:**
- Features: `feature/description`
- Bug fixes: `fix/description`
- Documentation: `docs/description`
- Refactoring: `refactor/description`

### 2. Make Changes

- Write code following [Coding Standards](#coding-standards)
- Test your changes thoroughly
- Keep commits focused and atomic
- Write clear commit messages

### 3. Test Your Changes

**Manual testing:**
1. Build: `npm run build`
2. Run: `npm run dev`
3. Test all affected features
4. Test on your platform (Windows/macOS/Linux)

**Testing checklist:**
- [ ] App starts without errors
- [ ] New feature works as expected
- [ ] Existing features still work
- [ ] UI looks correct
- [ ] No console errors
- [ ] Logs are appropriate

### 4. Commit Changes

```bash
git add .
git commit -m "Add feature: description of changes"
```

**Good commit messages:**
```
Add Docker health check monitoring

- Implement periodic health checks for Docker containers
- Add visual indicators for service health status
- Update dashboard to show health information
```

**Bad commit messages:**
```
fixed stuff
update
WIP
```

### 5. Push to Your Fork

```bash
git push origin feature/my-feature
```

### 6. Create Pull Request

1. Go to your fork on GitHub
2. Click "New Pull Request"
3. Select your feature branch
4. Fill out the PR template
5. Link related issues
6. Submit!

---

## Coding Standards

### TypeScript Style

**General:**
- Use TypeScript for all new code
- Strict typing (avoid `any` when possible)
- Prefer interfaces over types for object shapes
- Use enums for constants

**Naming conventions:**
```typescript
// Classes: PascalCase
class DockerManager { }

// Interfaces: PascalCase with I prefix (optional)
interface IDockerConfig { }
// Or without prefix (preferred)
interface DockerConfig { }

// Variables and functions: camelCase
const dockerVersion = '1.0.0';
function startDocker() { }

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 5;
const DEFAULT_PORT = 5432;

// Files: kebab-case
docker-manager.ts
env-config.ts
```

**Example:**
```typescript
// Good
interface ServiceStatus {
  name: string;
  isRunning: boolean;
  port: number;
}

async function getServiceStatus(serviceName: string): Promise<ServiceStatus> {
  const result = await checkService(serviceName);
  return {
    name: serviceName,
    isRunning: result.running,
    port: result.port
  };
}

// Bad
async function get_service_status(service: any): Promise<any> {
  let result = await checkService(service);
  return result;
}
```

### Code Organization

**Modules:**
- One feature per file
- Export public API
- Keep internal functions private
- Group related functionality

**Example structure:**
```typescript
// docker.ts

// Imports
import { exec } from 'child_process';
import logger from './logger';

// Types and interfaces
export interface DockerConfig {
  version: string;
  running: boolean;
}

// Constants
const DOCKER_COMMAND = 'docker';
const MAX_WAIT_TIME = 30000;

// Private helper functions
function parseDockerVersion(output: string): string {
  // ...
}

// Public API
export async function checkDockerInstalled(): Promise<boolean> {
  // ...
}

export async function startDocker(): Promise<void> {
  // ...
}
```

### Error Handling

**Always handle errors:**
```typescript
// Good
async function riskyOperation() {
  try {
    const result = await doSomething();
    return { success: true, data: result };
  } catch (error) {
    logger.error('Operation failed', error);
    return { success: false, error: error.message };
  }
}

// Bad
async function riskyOperation() {
  const result = await doSomething(); // May throw!
  return result;
}
```

**Return structured results:**
```typescript
interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function operation(): Promise<Result<string>> {
  try {
    const data = await fetch();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### Logging

**Use the logger module:**
```typescript
import logger from './logger';

// Different levels
logger.info('Operation started');
logger.warn('Resource low');
logger.error('Operation failed', error);

// With categories
import { logWithCategory, LogCategory } from './logger';

logWithCategory('info', LogCategory.DOCKER, 'Starting Docker...');
```

**What to log:**
- User actions
- System state changes
- API calls
- Errors and warnings
- Important milestones

**What NOT to log:**
- Passwords or secrets
- Excessive debug info in production
- Personal data

### Comments

**Write self-documenting code:**
```typescript
// Good - code explains itself
function calculatePasswordStrength(password: string): number {
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*]/.test(password);

  const criteria = [hasUppercase, hasLowercase, hasNumbers, hasSpecial];
  return criteria.filter(Boolean).length;
}

// Bad - needs comments to explain
function calc(p: string): number {
  // Check if has uppercase
  const u = /[A-Z]/.test(p);
  // Check if has lowercase
  const l = /[a-z]/.test(p);
  // Count criteria
  return [u, l].filter(x => x).length;
}
```

**Add comments for:**
- Complex algorithms
- Non-obvious behavior
- Workarounds
- TODOs

**Use JSDoc for public APIs:**
```typescript
/**
 * Start Docker Desktop and wait for it to be ready
 *
 * @param progressCallback - Optional callback for progress updates
 * @returns Promise that resolves when Docker is ready
 * @throws Error if Docker fails to start
 */
export async function startAndWaitForDocker(
  progressCallback?: ProgressCallback
): Promise<void> {
  // Implementation
}
```

### HTML/CSS

**HTML:**
- Semantic HTML elements
- Accessible (ARIA labels where needed)
- Clean structure

**CSS:**
- Use classes, not IDs for styling
- Consistent naming (BEM or similar)
- Mobile-first responsive design

---

## Testing

### Manual Testing

**Before submitting PR:**
1. Test on your platform (Windows, macOS, or Linux)
2. Test all affected features
3. Test error cases
4. Test edge cases

**Test checklist:**
- [ ] Fresh installation works
- [ ] Upgrade from previous version works
- [ ] All setup wizard steps work
- [ ] Services start/stop correctly
- [ ] Configuration saves and loads
- [ ] Logs are generated correctly
- [ ] Error messages are clear
- [ ] UI is responsive

### Automated Testing (Future)

We plan to add:
- Unit tests (Jest)
- Integration tests (Spectron/Playwright)
- E2E tests

Contributions to testing infrastructure are welcome!

---

## Submitting Changes

### Pull Request Guidelines

**Before submitting:**
- [ ] Code follows style guidelines
- [ ] TypeScript compiles without errors
- [ ] Tested on your platform
- [ ] Commits are clean and well-described
- [ ] Updated documentation if needed
- [ ] No merge conflicts with main

**PR description should include:**
- What changes were made
- Why these changes were needed
- How to test the changes
- Screenshots (if UI changes)
- Related issue numbers

**PR template:**
```markdown
## Description
Brief description of changes

## Motivation
Why is this change needed?

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing
How to test these changes:
1. Step 1
2. Step 2
3. Expected result

## Screenshots
(If applicable)

## Related Issues
Fixes #123
Related to #456
```

### Review Process

1. **Automated checks** run (build, future: tests)
2. **Code review** by maintainers
3. **Requested changes** (if any)
4. **Approval** and **merge**

**Be patient!** Reviews may take a few days.

**Be responsive** to feedback and questions.

---

## Project Structure

```
MCP-Electron-App/
├── src/
│   ├── main/                # Main process (Node.js)
│   │   ├── index.ts         # Entry point, IPC setup
│   │   ├── prerequisites.ts  # Prerequisites checking
│   │   ├── docker.ts        # Docker management
│   │   ├── env-config.ts    # Environment configuration
│   │   ├── docker-images.ts # Docker image loading
│   │   ├── mcp-system.ts    # MCP system orchestration
│   │   ├── typingmind-downloader.ts
│   │   ├── client-selection.ts
│   │   ├── installation-wizard.ts
│   │   ├── setup-wizard.ts
│   │   ├── updater.ts       # Update checking
│   │   ├── logger.ts        # Logging system
│   │   ├── diagnostics.ts   # Diagnostics & testing
│   │   └── utils/           # Utility functions
│   ├── renderer/            # Renderer process (Browser)
│   │   ├── index.html       # Main UI
│   │   └── renderer.ts      # UI logic
│   └── preload/             # Preload scripts
│       └── preload.ts       # IPC bridge
├── resources/               # Build resources
│   ├── icons/              # App icons
│   └── docker-images/      # Bundled Docker images
├── docs/                   # Documentation
│   ├── USER-GUIDE.md
│   ├── TROUBLESHOOTING.md
│   ├── FAQ.md
│   ├── ARCHITECTURE.md
│   └── CONTRIBUTING.md (this file)
├── dist/                   # Compiled TypeScript (gitignored)
├── out/                    # Built installers (gitignored)
├── .github/
│   └── workflows/          # CI/CD workflows
│       ├── build.yml
│       └── release.yml
├── package.json
├── tsconfig.json
└── README.md
```

### Key Files

**`src/main/index.ts`**
- Electron app entry point
- Window creation
- Menu setup
- IPC handler registration

**`src/renderer/renderer.ts`**
- UI event handlers
- IPC client calls
- DOM manipulation

**`src/preload/preload.ts`**
- Secure IPC bridge
- Context isolation
- API exposure to renderer

**`package.json`**
- Dependencies
- Build scripts
- Electron Builder config

**`tsconfig.json`**
- TypeScript configuration
- Compiler options

---

## Common Tasks

### Adding a New Feature

**Example: Add new Docker operation**

1. **Create/update module** (`src/main/docker.ts`):
```typescript
export async function myNewOperation(): Promise<void> {
  logger.info('Starting new operation...');
  // Implementation
}
```

2. **Add IPC handler** (`src/main/index.ts`):
```typescript
ipcMain.handle('docker:my-operation', async () => {
  return await docker.myNewOperation();
});
```

3. **Add to preload** (`src/preload/preload.ts`):
```typescript
// Usually just uses generic invoke - no changes needed
```

4. **Add UI** (`src/renderer/index.html`):
```html
<button id="my-operation-btn">My Operation</button>
```

5. **Add event handler** (`src/renderer/renderer.ts`):
```typescript
document.getElementById('my-operation-btn')?.addEventListener('click', async () => {
  const result = await window.electron.invoke('docker:my-operation');
  if (result.success) {
    showSuccess('Operation completed!');
  }
});
```

6. **Test thoroughly**

### Adding a New Configuration Option

1. **Update interface** (`src/main/env-config.ts`):
```typescript
export interface EnvConfig {
  // ... existing fields
  MY_NEW_OPTION: string;
}
```

2. **Update default config**:
```typescript
export const DEFAULT_CONFIG: EnvConfig = {
  // ... existing fields
  MY_NEW_OPTION: 'default-value',
};
```

3. **Update UI** (add form field in HTML)

4. **Update validation** (if needed)

### Adding a New IPC Channel

1. **Define handler** in appropriate module
2. **Register in `index.ts`**:
```typescript
ipcMain.handle('category:action', async (_, arg1, arg2) => {
  return await module.action(arg1, arg2);
});
```
3. **Use in renderer**:
```typescript
const result = await window.electron.invoke('category:action', arg1, arg2);
```

### Adding Documentation

1. **User docs:** Update `docs/USER-GUIDE.md` or create new file
2. **Developer docs:** Update `docs/ARCHITECTURE.md` or `docs/CONTRIBUTING.md`
3. **Code docs:** Add JSDoc comments to public APIs
4. **README:** Update main README if needed

---

## Troubleshooting Development Issues

### TypeScript Won't Compile

**Check:**
- All dependencies installed: `npm install`
- TypeScript version: `npx tsc --version`
- Config file: `tsconfig.json` is valid

**Common errors:**
- Missing type definitions: `npm install @types/package-name`
- Syntax errors: Check recent changes
- Import errors: Ensure paths are correct

**Fix:**
```bash
npm run clean
npm install
npm run build
```

### Electron Won't Start

**Check:**
- TypeScript compiled: Check `dist/` directory exists
- No syntax errors in compiled JS
- All modules built

**Fix:**
```bash
npm run build
npm start
```

**Debug:**
- Open DevTools (automatically in dev mode)
- Check console for errors
- Check main process logs

### Build Errors

**Electron Builder fails:**
- Check `electron-builder` version
- Check platform-specific requirements
- Ensure all files are present

**Fix:**
```bash
npm run clean
npm run build
npm run package
```

### Docker Integration Issues

**During development:**
- Ensure Docker Desktop is running
- Test Docker commands manually
- Check logs for errors

**Debugging:**
```typescript
// Add extra logging
logger.debug('Docker command:', command);
logger.debug('Docker output:', output);
```

---

## Additional Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Electron Builder](https://www.electron.build/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)

---

## Questions?

- **General questions:** [GitHub Discussions](https://github.com/RLRyals/MCP-Electron-App/discussions)
- **Bug reports:** [GitHub Issues](https://github.com/RLRyals/MCP-Electron-App/issues)
- **Architecture questions:** See [ARCHITECTURE.md](ARCHITECTURE.md)

---

## License

By contributing to FictionLab App, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing!** Every contribution, no matter how small, helps make this project better. 🎉
