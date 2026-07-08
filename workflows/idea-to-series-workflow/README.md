# Idea to Series Workflow

Complete workflow from book idea to published 5-book series using AI agents.

## Overview

This workflow takes a user's book or series idea and guides them through:
- Market research
- Series architecture (5-book structure)
- Book planning and writing
- Quality validation
- Export to files

## Nodes (10 total)

1. **Capture Book/Series Idea** (user-input) - Get the author's concept
2. **Market Research** (planning) - Analyze trends and comp titles
3. **Series Architecture** (planning) - Design 5-book series structure
4. **Series Validation Gate** (gate) - NPE score must be ≥80
5. **Book Loop** (loop) - Process 5 books
   - **Book Planning** (planning)
   - **Chapter Loop** (loop) - For each chapter
     - **Write Chapter** (writing)
   - **Book Quality Gate** (gate) - Quality score ≥80
6. **Export Series** (file) - Save to project folder

## Agents Used

- market-research-agent
- series-architect-agent
- npe-series-validator-agent
- bailey-first-drafter
- commercial-validator-agent

## Estimated Time

50-75 hours for complete 5-book series (with AI assistance)

## Requirements

- Active Claude subscription
- Project folder selected
- Agents installed (will be prompted if missing)
