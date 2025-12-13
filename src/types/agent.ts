/**
 * Agent Type Definitions
 *
 * Agents are AI personas that orchestrate workflow phases.
 * They determine WHAT to do and WHEN to invoke skills.
 * Stored as markdown files with YAML frontmatter.
 */

/**
 * Agent frontmatter (from YAML front matter in markdown)
 */
export interface AgentFrontmatter {
  name: string;                     // Agent identifier
  description: string;              // What this agent does
  tools: string[];                  // Tools available to agent (Read, Write, WebSearch, etc.)
  autonomy: number;                 // Autonomy level (1-10)
}

/**
 * Skill invocation detected in agent markdown
 */
export interface SkillInvocation {
  skillName: string;                // Name of skill to invoke
  slashCommand: string;             // e.g., "/series-planning", "/book-planning"
  context: string;                  // When/why agent invokes this skill
  lineNumber?: number;              // Where in markdown this was found
}

/**
 * Complete parsed agent definition
 */
export interface AgentDefinition {
  filePath: string;                 // Path to agent markdown file
  frontmatter: AgentFrontmatter;
  content: string;                  // Full markdown content (after frontmatter)
  skillInvocations: SkillInvocation[];  // Skills this agent can invoke

  // Optional parsed sections
  sections?: {
    role?: string;                  // Role description
    responsibilities?: string[];    // List of responsibilities
    capabilities?: string[];        // List of capabilities
    workflows?: string[];           // Workflow descriptions
  };
}

/**
 * Agent installation status
 */
export interface AgentInstallStatus {
  name: string;
  exists: boolean;
  location?: 'bundled' | 'user' | 'marketplace';
  path?: string;
  version?: string;
}

/**
 * Agent registry entry (for quick lookup)
 */
export interface AgentRegistryEntry {
  name: string;
  description: string;
  autonomy: number;
  tools: string[];
  skills: string[];                 // List of skills this agent can invoke
  filePath: string;
  lastModified: Date;
}
