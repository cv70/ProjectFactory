# ProjectFactory

An autonomous software development system inspired by IdeaFactory. Unlike IdeaFactory which generates and explores ideas for knowledge work, ProjectFactory continuously generates project ideas, develops complete software projects from them, and iteratively optimizes those projects—all without human intervention.

## Goal

A self-sustaining system that can:
1. Continuously generate diverse software project ideas
2. Turn those ideas into fully functional code projects
3. Test, lint, and build each project automatically
4. Iteratively improve projects over time
5. Manage all projects with Git versioning

## Quick Start

```bash
# Install dependencies
cd backend
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your API keys

# Push database schema
npm run db:push

# Start development server
npm run dev
```

## Architecture

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

## Quality Gates

Projects must pass all quality gates before being committed:
- **Test Coverage**: ≥80%
- **Lint Errors**: 0
- **Build Success**: Required
- **Quality Score**: ≥70

## Technology Stack

| Component | Choice |
|-----------|--------|
| Backend | TypeScript + Node.js |
| Web Framework | Express |
| Agent Framework | LangChain.js + LangGraph |
| ORM | Drizzle ORM |
| Database | SQLite (better-sqlite3) |
| Validation | Zod |
| Testing | Vitest |

## API Endpoints

### Ideas
- `GET /api/ideas` - List all ideas
- `GET /api/ideas/:id` - Get idea details
- `POST /api/ideas` - Create new idea

### Projects
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get project details
- `POST /api/projects/:id/build` - Build project
- `POST /api/projects/:id/test` - Run tests

### Status
- `GET /api/status` - System status (active ideas, projects, iterations)
