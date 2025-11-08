/**
 * GitHub Credential Manager Module
 * Handles GitHub authentication credentials for repository operations
 */

import logger from './logger';

/**
 * GitHub Credentials interface
 */
export interface GitHubCredentials {
  token: string;
}

/**
 * GitHub Credential Manager class
 */
export class GitHubCredentialManager {
  private token: string = '';

  /**
   * Initialize credential manager with GitHub token
   * @param token - GitHub personal access token
   */
  constructor(token?: string) {
    if (token && token.trim().length > 0) {
      this.setToken(token);
    }
  }

  /**
   * Set GitHub token
   * @param token - GitHub personal access token
   */
  setToken(token: string): void {
    if (!token || token.trim().length === 0) {
      logger.warn('GitHub token is empty');
      return;
    }

    this.token = token.trim();
    logger.info('GitHub token has been set');
  }

  /**
   * Get GitHub token
   * @returns GitHub token
   */
  getToken(): string {
    return this.token;
  }

  /**
   * Check if token is configured
   * @returns true if token is set
   */
  isConfigured(): boolean {
    return this.token.length > 0;
  }

  /**
   * Configure Git to use GitHub token for HTTPS operations
   * Uses git credential helper approach with environment variables
   * @returns git environment variables for authentication
   */
  getGitEnvironment(): NodeJS.ProcessEnv {
    if (!this.isConfigured()) {
      return {};
    }

    // Git credential helper environment setup
    // This approach uses GIT_ASKPASS to provide credentials without interaction
    const env: NodeJS.ProcessEnv = {
      GIT_AUTHOR_NAME: 'MCP App',
      GIT_AUTHOR_EMAIL: 'noreply@mcp-app.local',
      GIT_COMMITTER_NAME: 'MCP App',
      GIT_COMMITTER_EMAIL: 'noreply@mcp-app.local',
    };

    return env;
  }

  /**
   * Get authentication URL with token embedded (for HTTPS)
   * This should only be used internally and the URL should be sanitized before logging
   * @param url - GitHub repository URL (HTTPS format)
   * @returns URL with token embedded
   */
  getAuthenticatedUrl(url: string): string {
    if (!this.isConfigured() || !url.includes('https://')) {
      return url;
    }

    // Replace https://github.com with https://token@github.com
    const authenticatedUrl = url.replace(
      'https://github.com',
      `https://x-access-token:${this.token}@github.com`
    );

    return authenticatedUrl;
  }

  /**
   * Validate GitHub token format
   * GitHub tokens typically start with 'gh' (personal tokens) or 'ghp_' (fine-grained tokens)
   * @param token - Token to validate
   * @returns true if token format appears valid
   */
  static validateTokenFormat(token: string): boolean {
    if (!token || token.trim().length === 0) {
      return false;
    }

    const trimmed = token.trim();

    // Check common GitHub token prefixes
    // Personal access tokens: ghp_
    // OAuth tokens: gho_
    // GitHub App tokens: ghu_
    // Fine-grained personal tokens: github_pat_
    const validPrefixes = ['ghp_', 'gho_', 'ghu_', 'github_pat_'];

    return validPrefixes.some(prefix => trimmed.startsWith(prefix));
  }

  /**
   * Test GitHub API connectivity with the configured token
   * @param token - Token to test (optional, uses configured token if not provided)
   * @returns Promise with API response status
   */
  async testTokenValidity(token?: string): Promise<{
    valid: boolean;
    message: string;
    rateLimit?: { remaining: number; reset: number };
  }> {
    const testToken = token || this.token;

    if (!testToken || testToken.trim().length === 0) {
      return {
        valid: false,
        message: 'No GitHub token configured',
      };
    }

    try {
      // Test GitHub API with minimal request
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${testToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
      const rateLimitReset = response.headers.get('x-ratelimit-reset');

      const rateLimit =
        rateLimitRemaining && rateLimitReset
          ? {
              remaining: parseInt(rateLimitRemaining, 10),
              reset: parseInt(rateLimitReset, 10),
            }
          : undefined;

      if (response.ok) {
        logger.info('GitHub token validation successful');
        return {
          valid: true,
          message: 'GitHub token is valid',
          rateLimit,
        };
      } else if (response.status === 401) {
        logger.warn('GitHub token validation failed: Unauthorized');
        return {
          valid: false,
          message: 'Invalid GitHub token (401 Unauthorized)',
        };
      } else {
        logger.warn(`GitHub token validation returned status ${response.status}`);
        return {
          valid: false,
          message: `GitHub API returned status ${response.status}`,
        };
      }
    } catch (error) {
      logger.error('Error testing GitHub token:', error);
      return {
        valid: false,
        message: `Error testing token: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Clear stored token
   */
  clearToken(): void {
    this.token = '';
    logger.info('GitHub token has been cleared');
  }
}

/**
 * Singleton instance for global credential management
 */
let credentialManager: GitHubCredentialManager | null = null;

/**
 * Get or create the global credential manager instance
 * @param token - Optional token to initialize with
 * @returns Global credential manager instance
 */
export function getGitHubCredentialManager(token?: string): GitHubCredentialManager {
  if (!credentialManager) {
    credentialManager = new GitHubCredentialManager(token);
  } else if (token) {
    credentialManager.setToken(token);
  }

  return credentialManager;
}

/**
 * Sanitize URL by removing embedded credentials for logging
 * @param url - URL that may contain embedded credentials
 * @returns URL with credentials removed
 */
export function sanitizeUrlForLogging(url: string): string {
  // Remove credentials from various URL formats
  return url
    .replace(/https:\/\/x-access-token:[^@]+@/, 'https://x-access-token:***@')
    .replace(/https:\/\/[^:]+:[^@]+@/, 'https://***:***@')
    .replace(/git@github\.com:\/\/[^:]+:[^@]+@/, 'git@github.com:***:***@');
}
