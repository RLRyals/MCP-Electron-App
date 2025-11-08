#!/bin/bash

# Script to create GitHub issues for Build Automation project
# Usage: ./create-github-issues.sh

set -e

REPO_OWNER="RLRyals"
REPO_NAME="MCP-Electron-App"
API_URL="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues"

# Check if GITHUB_TOKEN is set
if [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: GITHUB_TOKEN environment variable is not set"
    echo "Please set it with: export GITHUB_TOKEN=your_token_here"
    exit 1
fi

# Function to create an issue
create_issue() {
    local title="$1"
    local body="$2"
    local labels="$3"

    echo "Creating issue: $title"

    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Authorization: Bearer ${GITHUB_TOKEN}" \
        -H "Accept: application/vnd.github.v3+json" \
        "${API_URL}" \
        -d @- <<EOF
{
  "title": "${title}",
  "body": $(echo "${body}" | jq -Rs .),
  "labels": ${labels}
}
EOF
    )

    http_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq 201 ]; then
        issue_number=$(echo "$response_body" | jq -r '.number')
        issue_url=$(echo "$response_body" | jq -r '.html_url')
        echo "✓ Created issue #${issue_number}: ${issue_url}"
        echo "$issue_number"
    else
        echo "✗ Failed to create issue. HTTP code: $http_code"
        echo "$response_body" | jq .
        echo "ERROR"
    fi
}

echo "========================================="
echo "Creating GitHub Issues for Build Automation"
echo "Repository: ${REPO_OWNER}/${REPO_NAME}"
echo "========================================="
echo ""

# Issue #1: Create Setup Configuration Schema
issue1=$(create_issue \
"Create Setup Configuration Schema and Initial Config File" \
"## Description
Create a configuration system to define which repositories to download, build order, and custom commands.

## Tasks
- [ ] Create \`config/setup-config.json\` with schema for:
  - Repository definitions (URLs, clone paths, versions)
  - Build order and dependencies
  - Custom build commands
  - Docker image naming conventions
  - Optional component flags
- [ ] Add TypeScript interfaces for configuration types
- [ ] Add configuration validation logic
- [ ] Document configuration options in README

## Files to Create
- \`config/setup-config.json\`
- \`src/types/setup-config.ts\`
- \`src/utils/config-validator.ts\`

## Dependencies
None ✅ - Can start immediately

## Estimated Complexity
Low-Medium

## Labels
\`enhancement\`, \`phase-5-configuration\`" \
'["enhancement"]')

echo ""

# Issue #2: Implement RepositoryManager Class
issue2=$(create_issue \
"Implement RepositoryManager Class" \
"## Description
Create a RepositoryManager class to handle cloning repositories from GitHub with progress tracking.

## Tasks
- [ ] Create \`src/main/repository-manager.ts\`
- [ ] Implement methods:
  - \`cloneRepository(url: string, targetPath: string, options?: CloneOptions): Promise<void>\`
  - \`checkoutVersion(repoPath: string, version: string): Promise<void>\`
  - \`sparseCheckout(repoPath: string, paths: string[]): Promise<void>\`
  - \`getRepoStatus(repoPath: string): Promise<RepoStatus>\`
- [ ] Add progress callbacks for clone operations
- [ ] Add error handling for network failures, invalid URLs, disk space
- [ ] Add unit tests for RepositoryManager
- [ ] Support both HTTPS and SSH URLs

## Files to Create
- \`src/main/repository-manager.ts\`
- \`src/types/repository.ts\`
- \`tests/main/repository-manager.test.ts\`

## Dependencies
None ✅ - Can start immediately

## Estimated Complexity
Medium

## Labels
\`enhancement\`, \`phase-1-repository\`" \
'["enhancement"]')

echo ""

# Issue #3: Implement BuildOrchestrator Class
issue3=$(create_issue \
"Implement BuildOrchestrator Class" \
"## Description
Create a BuildOrchestrator class to execute npm install, npm build, and docker build commands with progress tracking.

## Tasks
- [ ] Create \`src/main/build-orchestrator.ts\`
- [ ] Implement methods:
  - \`npmInstall(repoPath: string, options?: NpmOptions): Promise<void>\`
  - \`npmBuild(repoPath: string, buildScript?: string): Promise<void>\`
  - \`dockerBuild(dockerfile: string, imageName: string, buildArgs?: Record<string, string>): Promise<void>\`
  - \`executeBuildChain(steps: BuildStep[]): Promise<void>\`
- [ ] Add progress callbacks and output streaming
- [ ] Capture stdout/stderr for debugging
- [ ] Add timeout handling
- [ ] Support build configuration files (\`build.config.json\`)
- [ ] Add unit tests for BuildOrchestrator

## Files to Create
- \`src/main/build-orchestrator.ts\`
- \`src/types/build.ts\`
- \`tests/main/build-orchestrator.test.ts\`

## Dependencies
None ✅ - Can start immediately

## Estimated Complexity
High

## Labels
\`enhancement\`, \`phase-2-build\`" \
'["enhancement"]')

echo ""
sleep 1  # Rate limiting

# Issue #4: Add IPC Handlers for Repository Operations
issue4=$(create_issue \
"Add IPC Handlers for Repository Operations" \
"## Description
Add IPC communication layer to expose RepositoryManager functionality to the renderer process.

## Tasks
- [ ] Add IPC handlers in \`src/main/index.ts\` for:
  - \`repository:clone\`
  - \`repository:checkout-version\`
  - \`repository:get-status\`
  - \`repository:clone-progress\` (event)
- [ ] Add corresponding IPC invocations in renderer
- [ ] Add type-safe IPC channel definitions
- [ ] Add integration tests for IPC handlers

## Files to Modify
- \`src/main/index.ts\`
- \`src/renderer/setup-wizard-handlers.ts\`
- \`src/types/ipc.ts\`

## Dependencies
⚠️ **Blocked by #${issue2}** (RepositoryManager must exist)

## Estimated Complexity
Low-Medium

## Labels
\`enhancement\`, \`phase-1-repository\`, \`ipc\`" \
'["enhancement"]')

echo ""

# Issue #5: Extend Docker Images Module for Build-from-Source Support
issue5=$(create_issue \
"Extend Docker Images Module for Build-from-Source Support" \
"## Description
Enhance docker-images.ts to support building Docker images from downloaded source repositories.

## Tasks
- [ ] Extend \`src/main/docker-images.ts\` with:
  - \`buildImageFromSource(repoPath: string, imageName: string, tag: string): Promise<void>\`
  - \`createDockerfileIfMissing(repoPath: string, template: string): Promise<void>\`
  - Image tagging and caching logic
  - Fallback to pre-built images on build failure
- [ ] Integrate with RepositoryManager to access cloned repos
- [ ] Integrate with BuildOrchestrator for Docker builds
- [ ] Add build progress tracking
- [ ] Update Docker image verification logic
- [ ] Add tests for build-from-source scenarios

## Files to Modify
- \`src/main/docker-images.ts\`

## Files to Create
- \`templates/Dockerfile.template\` (if needed)
- \`tests/main/docker-images-build.test.ts\`

## Dependencies
⚠️ **Blocked by #${issue2}** (RepositoryManager)
⚠️ **Blocked by #${issue3}** (BuildOrchestrator)

## Estimated Complexity
Medium

## Labels
\`enhancement\`, \`phase-3-docker\`" \
'["enhancement"]')

echo ""
sleep 1  # Rate limiting

# Issue #6: Implement Progress Tracking & UI Updates
issue6=$(create_issue \
"Implement Progress Tracking & UI Updates" \
"## Description
Create a unified progress tracking system for repository cloning, npm installs, builds, and Docker operations.

## Tasks
- [ ] Create progress event types and interfaces
- [ ] Add progress aggregation logic (combining multiple operations)
- [ ] Update Step 5 UI to show:
  - Current operation (clone, install, build, docker)
  - Progress percentage
  - Real-time console output
  - Error states with retry options
- [ ] Add cancel/abort functionality
- [ ] Add \"View Logs\" functionality for completed operations
- [ ] Test progress tracking with slow network/build scenarios

## Files to Create
- \`src/types/progress.ts\`
- \`src/utils/progress-aggregator.ts\`

## Files to Modify
- \`src/renderer/setup-wizard-handlers.ts\`
- \`src/renderer/components/SetupStep5.tsx\` (or relevant Step 5 component)

## Dependencies
⚠️ **Blocked by #${issue2}** (RepositoryManager for real progress events)
⚠️ **Blocked by #${issue3}** (BuildOrchestrator for real progress events)

## Estimated Complexity
Medium

## Labels
\`enhancement\`, \`ui\`, \`phase-4-wizard\`" \
'["enhancement"]')

echo ""

# Issue #7: Integrate Full Build Pipeline into Setup Wizard Step 5
issue7=$(create_issue \
"Integrate Full Build Pipeline into Setup Wizard Step 5" \
"## Description
Wire all components together in Setup Wizard Step 5 to provide the complete automated setup experience.

## Tasks
- [ ] Update Step 5 (Download & Setup) to orchestrate:
  - Download all repositories defined in setup-config.json
  - Run npm install for each repository in dependency order
  - Execute npm builds for each repository
  - Build Docker images from source
  - Verify all build artifacts
- [ ] Implement build order resolution based on dependencies
- [ ] Add \"skip optional components\" functionality
- [ ] Integrate progress tracking UI
- [ ] Add comprehensive error handling
- [ ] Create integration tests for full pipeline
- [ ] Update setup wizard documentation

## Files to Modify
- \`src/renderer/setup-wizard-handlers.ts\`
- \`src/main/index.ts\` (IPC orchestration)

## Dependencies
⚠️ **Blocked by #${issue2}** (RepositoryManager)
⚠️ **Blocked by #${issue3}** (BuildOrchestrator)
⚠️ **Blocked by #${issue4}** (IPC Handlers)
⚠️ **Blocked by #${issue5}** (Docker Build Integration)
⚠️ **Blocked by #${issue6}** (Progress Tracking)

## Estimated Complexity
High

## Labels
\`enhancement\`, \`phase-4-wizard\`, \`integration\`" \
'["enhancement"]')

echo ""
sleep 1  # Rate limiting

# Issue #8: Add Comprehensive Error Handling & Retry Logic
issue8=$(create_issue \
"Add Comprehensive Error Handling & Retry Logic" \
"## Description
Add robust error handling and retry mechanisms across all build automation components.

## Tasks
- [ ] Add retry logic for:
  - Git clone failures (network issues)
  - npm install failures (registry issues)
  - Build failures (transient issues)
  - Docker build failures
- [ ] Implement exponential backoff for retries
- [ ] Add user-friendly error messages with suggestions
- [ ] Create error recovery strategies:
  - Resume from last successful step
  - Skip failed optional components
  - Rollback on critical failures
- [ ] Add error logging and diagnostics collection
- [ ] Add \"Retry Failed Step\" UI button
- [ ] Create error handling documentation

## Files to Modify
- \`src/main/repository-manager.ts\`
- \`src/main/build-orchestrator.ts\`
- \`src/main/docker-images.ts\`
- \`src/renderer/setup-wizard-handlers.ts\`

## Files to Create
- \`src/utils/error-handler.ts\`
- \`src/utils/retry-strategy.ts\`

## Dependencies
⚠️ **Can be implemented incrementally** as #${issue2}, #${issue3}, #${issue5} are completed

## Estimated Complexity
Medium-High

## Labels
\`enhancement\`, \`reliability\`" \
'["enhancement"]')

echo ""
echo "========================================="
echo "Summary of Created Issues:"
echo "Issue #${issue1}: Configuration Schema (No dependencies)"
echo "Issue #${issue2}: RepositoryManager (No dependencies)"
echo "Issue #${issue3}: BuildOrchestrator (No dependencies)"
echo "Issue #${issue4}: IPC Handlers (Depends on #${issue2})"
echo "Issue #${issue5}: Docker Build Integration (Depends on #${issue2}, #${issue3})"
echo "Issue #${issue6}: Progress Tracking (Depends on #${issue2}, #${issue3})"
echo "Issue #${issue7}: Setup Wizard Integration (Depends on #${issue2}, #${issue3}, #${issue4}, #${issue5}, #${issue6})"
echo "Issue #${issue8}: Error Handling (Incremental)"
echo "========================================="
echo ""
echo "Parallel Work Strategy:"
echo "Sprint 1 (Start immediately): Issues #${issue1}, #${issue2}, #${issue3}"
echo "Sprint 2 (After Sprint 1): Issues #${issue4}, #${issue5}, #${issue6}"
echo "Sprint 3 (After Sprint 2): Issues #${issue7}, #${issue8}"
echo ""
echo "Done! All issues created successfully."
