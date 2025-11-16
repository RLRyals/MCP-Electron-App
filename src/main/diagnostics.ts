/**
 * Diagnostics module for system testing and report generation
 */

import { app, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { collectSystemInfo, getDockerLogs, runSystemChecks } from './utils/system-info';
import { sanitizeEnvFileContent, sanitizeLogContent } from './utils/sanitize';
import { getLogFiles, getLogsDirectory } from './logger';
import logger from './logger';

/**
 * Open the log file in the default text editor
 */
export async function openLogFile(): Promise<void> {
  try {
    const logFiles = getLogFiles();

    if (logFiles.length === 0) {
      throw new Error('No log files found');
    }

    // Open the most recent log file
    const mostRecentLog = logFiles[0];
    await shell.openPath(mostRecentLog);

    logger.info('Opened log file:', mostRecentLog);
  } catch (error) {
    logger.error('Error opening log file:', error);
    throw error;
  }
}

/**
 * Open the logs directory in the file explorer
 */
export async function openLogsDirectory(): Promise<void> {
  try {
    const logsDir = getLogsDirectory();
    await shell.openPath(logsDir);
    logger.info('Opened logs directory:', logsDir);
  } catch (error) {
    logger.error('Error opening logs directory:', error);
    throw error;
  }
}

/**
 * Create a diagnostic report as a directory with files
 */
export async function createDiagnosticReport(): Promise<string> {
  try {
    logger.info('Creating diagnostic report...');

    // Get the downloads directory
    const downloadsPath = app.getPath('downloads');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportDirName = `mcp-diagnostic-report-${timestamp}`;
    const reportPath = path.join(downloadsPath, reportDirName);

    // Create report directory
    if (!fs.existsSync(reportPath)) {
      fs.mkdirSync(reportPath, { recursive: true });
    }

    // Create logs subdirectory
    const logsDir = path.join(reportPath, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Add system information
    const systemInfo = await collectSystemInfo();
    fs.writeFileSync(
      path.join(reportPath, 'system-info.json'),
      JSON.stringify(systemInfo, null, 2)
    );

    // Add log files
    const logFiles = getLogFiles();
    for (const logFile of logFiles) {
      try {
        const logContent = fs.readFileSync(logFile, 'utf-8');
        const sanitizedContent = sanitizeLogContent(logContent);
        const fileName = path.basename(logFile);
        fs.writeFileSync(path.join(logsDir, fileName), sanitizedContent);
      } catch (error) {
        logger.error(`Error adding log file ${logFile}:`, error);
      }
    }

    // Add Docker logs if available
    try {
      const dockerLogs = await getDockerLogs();
      fs.writeFileSync(path.join(reportPath, 'docker-logs.txt'), dockerLogs);
    } catch (error) {
      logger.warn('Could not collect Docker logs:', error);
      fs.writeFileSync(
        path.join(reportPath, 'docker-logs.txt'),
        'Docker logs not available'
      );
    }

    // Add .env file if it exists (sanitized)
    const envFilePath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envFilePath)) {
      try {
        const envContent = fs.readFileSync(envFilePath, 'utf-8');
        const sanitizedEnvContent = sanitizeEnvFileContent(envContent);
        fs.writeFileSync(path.join(reportPath, 'env.txt'), sanitizedEnvContent);
      } catch (error) {
        logger.error('Error adding .env file:', error);
      }
    }

    // Add package.json for version information
    const packageJsonPath = path.join(__dirname, '../../package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = fs.readFileSync(packageJsonPath, 'utf-8');
        fs.writeFileSync(path.join(reportPath, 'package.json'), packageJson);
      } catch (error) {
        logger.error('Error adding package.json:', error);
      }
    }

    // Create a README file
    const readmeContent = `# FictionLab - Diagnostic Report

Generated: ${new Date().toISOString()}

## Contents

- system-info.json: System and application information
- logs/: Application log files (sanitized)
- docker-logs.txt: Docker container logs (if available)
- env.txt: Environment variables (sanitized)
- package.json: Application package information

## Notes

All sensitive information (passwords, tokens, API keys) has been sanitized and replaced with [REDACTED].
`;

    fs.writeFileSync(path.join(reportPath, 'README.md'), readmeContent);

    logger.info(`Diagnostic report created: ${reportPath}`);
    return reportPath;
  } catch (error) {
    logger.error('Error creating diagnostic report:', error);
    throw error;
  }
}

/**
 * Export diagnostic report and show it in file explorer
 */
export async function exportDiagnosticReport(): Promise<{
  success: boolean;
  path?: string;
  error?: string;
}> {
  try {
    const reportPath = await createDiagnosticReport();

    // Show the file in the file explorer
    shell.showItemInFolder(reportPath);

    return {
      success: true,
      path: reportPath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run comprehensive system tests
 */
export async function testSystem(): Promise<{
  passed: boolean;
  systemInfo: any;
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
  }>;
}> {
  try {
    logger.info('Running system tests...');

    const systemInfo = await collectSystemInfo();
    const { passed, checks } = await runSystemChecks();

    logger.info('System tests completed', { passed, checksCount: checks.length });

    return {
      passed,
      systemInfo,
      checks,
    };
  } catch (error) {
    logger.error('Error running system tests:', error);
    throw error;
  }
}

/**
 * Generate a GitHub issue template with error details
 */
export function generateGitHubIssueTemplate(
  errorTitle: string,
  errorMessage: string,
  errorStack?: string
): string {
  const template = `
## Bug Report

**Error:** ${errorTitle}

**Description:**
${errorMessage}

**Stack Trace:**
\`\`\`
${errorStack || 'No stack trace available'}
\`\`\`

**Environment:**
- App Version: ${app.getVersion()}
- Platform: ${process.platform}
- Arch: ${process.arch}
- Electron: ${process.versions.electron}
- Node: ${process.versions.node}

**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**


**Actual Behavior:**


**Additional Context:**

`;

  return template.trim();
}

/**
 * Get the GitHub new issue URL with pre-filled template
 */
export function getGitHubIssueUrl(
  errorTitle: string,
  errorMessage: string,
  errorStack?: string
): string {
  const repoUrl = 'https://github.com/yourusername/mcp-electron-app'; // Update with actual repo URL
  const template = generateGitHubIssueTemplate(errorTitle, errorMessage, errorStack);

  const params = new URLSearchParams({
    title: `Bug: ${errorTitle}`,
    body: template,
  });

  return `${repoUrl}/issues/new?${params.toString()}`;
}

/**
 * Open GitHub issue page with pre-filled template
 */
export async function openGitHubIssue(
  errorTitle: string,
  errorMessage: string,
  errorStack?: string
): Promise<void> {
  const url = getGitHubIssueUrl(errorTitle, errorMessage, errorStack);
  await shell.openExternal(url);
  logger.info('Opened GitHub issue template');
}
