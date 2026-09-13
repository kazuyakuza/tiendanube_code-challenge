# AI Agent Onboarding

This document provides essential information for AI agents working on this project.
Full read all sections files.

This project supports both **Kilo Code** (`.kilo/`) and **opencode** (`.opencode/` + `opencode.json`). Agent definitions and commands exist in both directories; the rules in `.kilo/rules/` are shared. In opencode, the default agent is `planner` and the Critical Workflow is available as `/critical-workflow`.

## Project Info Files

All project info files live in `.agent/project-info/`:

- [brief.md](.agent/project-info/brief.md) - Core requirements, goals, and source of truth for project scope.
- [product.md](.agent/project-info/product.md) - Core user experience, problem definition, and product goals.
- [context.md](.agent/project-info/context.md) - Factual log: current work focus, recent changes, and immediate next steps.
- [architecture.md](.agent/project-info/architecture.md) - System architecture, paths, design patterns, and critical paths.
- [tech.md](.agent/project-info/tech.md) - Stack, development setup, technical constraints, and tool usage patterns.

## [Workflows](.agent/WORKFLOWS.md)

## [Rules](.agent/RULES.md)

## Project Info

All agents must read the [Project Info Instructions](.agent/project-info/instructions.md) at the beginning of each task. This ensures that the agent has a complete understanding of the project's context, architecture, and technical specifications.
