/**
 * Dependency Resolver
 *
 * Checks which agents, skills, and MCP servers are installed
 * for workflow dependencies.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { app } from 'electron';
import { Pool } from 'pg';
import { getDatabasePool } from '../database-connection';
import { logWithCategory, LogCategory } from '../logger';

export interface DependencyCheckResult {
  installed: string[];
  missing: string[];
}

export interface AllDependencies {
  agents: DependencyCheckResult;
  skills: DependencyCheckResult;
  mcpServers: DependencyCheckResult;
  subWorkflows: DependencyCheckResult;
}

export class DependencyResolver {
  private pool: Pool;

  constructor() {
    this.pool = getDatabasePool();
  }

  /**
   * Check all dependencies for a workflow
   */
  async checkDependencies(dependencies: {
    agents: string[];
    skills: string[];
    mcpServers: string[];
    subWorkflows?: string[];
  }): Promise<AllDependencies> {
    logWithCategory('info', LogCategory.WORKFLOW,
      `Checking dependencies for workflow`);

    const results = {
      agents: await this.checkAgents(dependencies.agents),
      skills: await this.checkSkills(dependencies.skills),
      mcpServers: await this.checkMCPServers(dependencies.mcpServers),
      subWorkflows: await this.checkSubWorkflows(dependencies.subWorkflows || [])
    };

    logWithCategory('info', LogCategory.WORKFLOW,
      `Dependency check complete: ` +
      `${results.agents.missing.length} agents, ` +
      `${results.skills.missing.length} skills, ` +
      `${results.mcpServers.missing.length} MCPs, ` +
      `${results.subWorkflows.missing.length} sub-workflows missing`);

    return results;
  }

  /**
   * Check agents (look in userData/agents)
   */
  private async checkAgents(agents: string[]): Promise<DependencyCheckResult> {
    const userDataPath = app.getPath('userData');
    const agentsDir = path.join(userDataPath, 'agents');

    // Ensure agents directory exists
    await fs.ensureDir(agentsDir);

    const installed: string[] = [];
    const missing: string[] = [];

    for (const agent of agents) {
      const agentPath = path.join(agentsDir, `${agent}.md`);
      if (await fs.pathExists(agentPath)) {
        installed.push(agent);
        logWithCategory('debug', LogCategory.WORKFLOW,
          `Agent found: ${agent}`);
      } else {
        missing.push(agent);
        logWithCategory('debug', LogCategory.WORKFLOW,
          `Agent missing: ${agent}`);
      }
    }

    return { installed, missing };
  }

  /**
   * Check skills (look in ~/.claude/skills)
   */
  private async checkSkills(skills: string[]): Promise<DependencyCheckResult> {
    const homeDir = require('os').homedir();
    const skillsDir = path.join(homeDir, '.claude', 'skills');

    // Ensure skills directory exists
    await fs.ensureDir(skillsDir);

    const installed: string[] = [];
    const missing: string[] = [];

    for (const skill of skills) {
      const skillPath = path.join(skillsDir, `${skill}.md`);
      if (await fs.pathExists(skillPath)) {
        installed.push(skill);
        logWithCategory('debug', LogCategory.WORKFLOW,
          `Skill found: ${skill}`);
      } else {
        missing.push(skill);
        logWithCategory('debug', LogCategory.WORKFLOW,
          `Skill missing: ${skill}`);
      }
    }

    return { installed, missing };
  }

  /**
   * Check MCP servers (query database or check running containers)
   */
  private async checkMCPServers(mcpServers: string[]): Promise<DependencyCheckResult> {
    // For now, assume all MCP servers are available if Docker is running
    // In production, you'd query the MCP servers list or check Docker containers

    logWithCategory('debug', LogCategory.WORKFLOW,
      `Assuming all MCP servers are available: ${mcpServers.join(', ')}`);

    return {
      installed: mcpServers,
      missing: []
    };
  }

  /**
   * Check sub-workflows (query workflow_definitions table)
   */
  private async checkSubWorkflows(subWorkflows: string[]): Promise<DependencyCheckResult> {
    if (subWorkflows.length === 0) {
      return { installed: [], missing: [] };
    }

    try {
      const result = await this.pool.query(`
        SELECT DISTINCT id FROM workflow_definitions
        WHERE id = ANY($1::text[])
      `, [subWorkflows]);

      const installed = result.rows.map(r => r.id);
      const missing = subWorkflows.filter(sw => !installed.includes(sw));

      logWithCategory('debug', LogCategory.WORKFLOW,
        `Sub-workflows check: ${installed.length} installed, ${missing.length} missing`);

      return { installed, missing };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Error checking sub-workflows: ${error.message}`);

      // If there's an error (e.g., table doesn't exist), assume all are missing
      return {
        installed: [],
        missing: subWorkflows
      };
    }
  }

  /**
   * Get installed agents list from ~/.claude/agents/
   * This is where Claude Code naturally looks for agents
   */
  async getInstalledAgents(): Promise<string[]> {
    const homeDir = require('os').homedir();
    const agentsDir = path.join(homeDir, '.claude', 'agents');

    if (!await fs.pathExists(agentsDir)) {
      return [];
    }

    const files = await fs.readdir(agentsDir);
    return files
      .filter(file => file.endsWith('.md'))
      .map(file => path.basename(file, '.md'));
  }

  /**
   * Get installed skills list
   */
  async getInstalledSkills(): Promise<string[]> {
    const homeDir = require('os').homedir();
    const skillsDir = path.join(homeDir, '.claude', 'skills');

    if (!await fs.pathExists(skillsDir)) {
      return [];
    }

    const files = await fs.readdir(skillsDir);
    return files
      .filter(file => file.endsWith('.md'))
      .map(file => path.basename(file, '.md'));
  }
}
