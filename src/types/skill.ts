/**
 * Skill Type Definitions
 *
 * Skills are executable workflows for Claude Code.
 * They define HOW to accomplish tasks with multi-phase processes.
 * Stored as markdown files with YAML frontmatter in ~/.claude/skills/
 */

/**
 * Skill metadata from YAML frontmatter
 */
export interface SkillMetadata {
  name: string;                     // Skill identifier (matches directory name)
  description: string;              // What this skill does (for Claude's decision-making)
  version?: string;                 // Skill version
  phase?: string;                   // 'planning', 'writing', 'validation', etc.
  mcps?: string[];                  // MCP servers required for this skill
  genre?: string;                   // Genre-specific (if applicable)

  // Optional metadata
  author?: string;
  created?: string;
  updated?: string;
}

/**
 * MCP operation within a skill phase
 */
export interface MCPOperation {
  server: string;                   // Which MCP server (e.g., 'series-planning-server')
  operation: string;                // Operation name (e.g., 'create_series', 'get_world_rules')
  requiresApproval: boolean;        // Does this operation need user approval?
  type?: 'read' | 'write' | 'update' | 'delete';
}

/**
 * Individual phase within a multi-phase skill
 */
export interface SkillPhase {
  id: number;
  name: string;
  objectives: string[];             // What this phase accomplishes
  activities?: string[];            // Steps in this phase
  mcpOperations: MCPOperation[];    // MCP operations in this phase
  requiresApproval: boolean;        // Phase-level approval requirement
  completionCriteria?: string[];    // How to know this phase is complete

  // Extracted from markdown
  content?: string;                 // Full markdown content for this phase
}

/**
 * Complete skill definition (parsed from markdown)
 */
export interface SkillDefinition {
  filePath: string;                 // Path to SKILL.md
  metadata: SkillMetadata;
  phases: SkillPhase[];             // Multi-phase structure (if applicable)
  content: string;                  // Full markdown content

  // Optional parsed sections
  sections?: {
    guardrails?: string;            // Mandatory guardrails section
    mcpInteractions?: string;       // MCP server interactions section
    workflow?: string;              // Core workflow description
    validation?: string[];          // Validation checklist
  };
}

/**
 * Skill installation status
 */
export interface SkillInstallStatus {
  name: string;
  exists: boolean;
  location?: 'bundled' | 'claude-skills' | 'marketplace';  // ~/.claude/skills/ vs bundled
  path?: string;
  version?: string;
  mcpsAvailable: boolean;           // Are required MCP servers available?
  missingMcps?: string[];
}

/**
 * Skill registry entry (for quick lookup)
 */
export interface SkillRegistryEntry {
  name: string;
  description: string;
  phase: string;
  mcps: string[];
  filePath: string;
  phaseCount: number;               // How many phases in this skill
  requiresApproval: boolean;        // Does any phase require approval?
  lastModified: Date;
}

/**
 * Skill invocation context (runtime)
 */
export interface SkillInvocationContext {
  skillName: string;
  agent: string;                    // Which agent is invoking this skill
  workflowPhase: number;            // Which workflow phase triggered this
  instanceId: string;               // Workflow instance ID
  context: Record<string, any>;     // Execution context variables
}
