# Contributing to WebVNC

Thank you for considering contributing! This guide will help you get started.

## Development setup

```bash
# 1. Fork and clone
git clone https://github.com/elias4044/webvnc.git
cd webvnc

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env

# 4. Start dev servers (Fastify + Vite in parallel)
npm run dev
```

The Vite dev server runs on **http://localhost:5173** and proxies API calls
to the Fastify server on **http://localhost:3000**.

## Scripts

| Command              | Description                        |
|----------------------|------------------------------------|
| `npm run dev`        | Start all dev servers concurrently |
| `npm run build`      | Production build (client + server) |
| `npm start`          | Run production server              |
| `npm test`           | Run all tests                      |
| `npm run lint`       | Lint TypeScript                    |
| `npm run lint:fix`   | Auto-fix lint issues               |
| `npm run format`     | Format with Prettier               |
| `npm run typecheck`  | Full TypeScript type check         |

## Code style

- TypeScript strict mode — no `any`, no `@ts-ignore`
- Prettier for formatting (configured in `.prettierrc`)
- ESLint with typescript-eslint strict rules
- Functional-where-practical, class-based components for UI

## Pull request checklist

- [ ] Tests pass (`npm test`)
- [ ] No lint errors (`npm run lint`)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] Code is formatted (`npm run format:check`)
- [ ] A clear description of what changed and why

## Project structure

```
src/
  server/          Fastify backend
    config/        Environment-based config with Zod validation
    plugins/       Fastify plugin registrations (CORS, helmet, etc.)
    routes/        API route handlers
    services/      Business logic
    utils/         Shared server utilities
  client/          Browser frontend (vanilla TypeScript)
    components/    Dashboard UI components
    vnc/           noVNC integration
    styles/        CSS design system
    utils/         Shared client utilities
tests/             Vitest test suite
```

## Adding a new feature

1. Create a branch: `git checkout -b feat/my-feature`
2. Implement changes with tests
3. Open a pull request against `main`

## Reporting a bug

Please open a GitHub issue with:
- Steps to reproduce
- Expected behaviour
- Actual behaviour
- Node.js and browser versions
