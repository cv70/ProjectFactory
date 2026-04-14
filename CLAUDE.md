# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProjectFactory is an autonomous software development system that continuously generates project ideas, develops complete software projects, and iteratively optimizes them—all without human intervention. It's inspired by IdeaFactory but focuses on software development rather than knowledge work.

## Development Commands

```bash
# From the backend/ directory

# Install dependencies
npm install

# Start development server (with hot reload via tsx watch)
npm run dev

# Build TypeScript to JavaScript
npm run build

# Start production server
npm start

# Run tests (Vitest)
npm test

# Run linter
npm run lint

# Database operations
npm run db:push      # Push schema changes to SQLite
npm run db:studio    # Open Drizzle Studio (database GUI)
npm run db:generate  # Generate migration files
```

## Technology Stack

- **Backend**: TypeScript + Node.js (ES2022, ES modules)
- **Web Framework**: Express
- **Agent Framework**: LangChain.js + LangGraph (for state machine orchestration)
- **ORM**: Drizzle ORM
- **Database**: SQLite (better-sqlite3)
- **Validation**: Zod
- **Testing**: Vitest

## Architecture

### High-Level Flow

```
OrchestratorAgent (LangGraph state machine)
    ├── IdeaGeneratorAgent (Planner → Executor → Critic)
    ├── ArchitectAgent
    ├── CoderAgent
    ├── TesterAgent
    ├── ReviewerAgent
    ├── OptimizerAgent
    └── GitAgent
```

### Project Development Pipeline

1. **Idea Generation**: Planner generates strategy → Executor creates ideas → Critic evaluates
2. **Architecture**: Design project structure, dependencies, and tech stack
3. **Coding**: Generate all project files and configuration
4. **Testing**: Generate tests, run them, analyze coverage
5. **Review**: Lint, static analysis, LLM code review
6. **Quality Gate**: Check if thresholds met (else → Optimizer → back to step 3)
7. **Git**: Initialize repo, commit with generated message
8. **Completion**: Move to completed directory

### Project State Machine

```
pending → queued → in_progress → (generating → testing → building → reviewing) → completed/failed
```

## Quality Gates

Projects must pass all quality gates before being committed:
- **Test Coverage**: ≥80%
- **Lint Errors**: 0
- **Build Success**: Required
- **Quality Score**: ≥70

## Directory Structure

```
backend/
├── src/
│   ├── api/              # HTTP API layer (not yet implemented)
│   ├── orchestration/    # LangGraph state machine and workflow
│   ├── agents/           # All specialized agents
│   │   ├── base/         # Base agent class and interfaces
│   │   ├── idea-generator/  # Planner, Executor, Critic
│   │   ├── architect/    # Architecture design
│   │   ├── coder/        # Code generation
│   │   ├── tester/       # Test generation and execution
│   │   ├── reviewer/     # Code review and quality scoring
│   │   ├── optimizer/    # Iteration planning
│   │   └── git/          # Git operations
│   ├── domain/           # Business entities and logic
│   ├── infra/   # External integrations (DB, Git, LLM, etc.)
│   ├── config/           # Configuration management
│   └── utils/            # Shared utilities
├── drizzle/              # Database schema and config
├── data/                 # SQLite database file (project-factory.db)
└── dist/                 # Compiled output

projects/
├── active/       # Currently developing projects
├── completed/    # Finished projects
└── archived/     # Archived projects
```

## Database Schema

Key tables (defined in `drizzle/schema.ts`):
- `ideas`: Generated project ideas with status tracking
- `projects`: Projects being developed with quality metrics
- `iterations`: Optimization iterations
- `quality_metrics`: Detailed quality metrics over time
- `runtime_state`: Orchestrator state persistence

## Agent Implementation Pattern

All agents extend `BaseAgent` from `src/agents/base/base-agent.ts` and use LangChain.js:

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

class MyAgent extends BaseAgent<Input, Output> {
  readonly name = 'MyAgent';

  getChain() {
    // Use withStructuredOutput for type-safe LLM responses
    const schema = z.object({ /* ... */ });
    return this.llm.withStructuredOutput(schema);
  }

  async execute(input: Input, context: ExecutionContext) {
    // Execute chain and return AgentResult
  }
}
```

## LangGraph State Management

The workflow uses LangGraph for complex state management. State is defined in `src/orchestration/langgraph/types.ts` as `ProjectFactoryState`. Key properties:
- `stage`: Current development stage
- `architecture`, `generatedFiles`, `testResults`, `reviewResult`: Intermediate artifacts
- `iterationCount`, `qualityScore`: Optimization tracking
- `errors`: Error handling with retry support

## Configuration

Configuration is loaded from environment variables and validated using Zod schemas in `src/config/project-factory.ts`. Required environment variable:
- `LLM_API_KEY`: OpenAI-compatible API key

Key configurable areas:
- LLM settings (model, temperature, max tokens)
- Workspace paths
- Pipeline behavior (intervals, batch sizes)
- Quality thresholds
- Resource limits

## Testing

Run tests with `npm test`. Tests use Vitest and should be placed in:
- `tests/unit/` - Unit tests for individual modules
- `tests/integration/` - Integration tests
- `tests/e2e/` - End-to-end workflow tests

## Adding New Agents

1. Create agent class in `src/agents/<agent-name>/`
2. Extend `BaseAgent<Input, Output>`
3. Implement `getChain()` method
4. Register in `src/agents/base/agent-factory.ts`
5. Add node to LangGraph in `src/orchestration/langgraph/`

## Adding Project Types

Add new project types to the enum in `drizzle/schema.ts`:
```typescript
projectType: text('project_type', {
  enum: ['web-app', 'cli-tool', 'library', 'api-service', 'your-new-type']
})
```

## Important Notes

- All files use ES modules (`"type": "module"` in package.json)
- TypeScript is configured with strict mode
- Use path alias `@/` for imports from `src/`
- Database is SQLite, stored in `backend/data/project-factory.db`
- The project is still in early development—many agents and the main workflow are not yet implemented
