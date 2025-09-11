# AGENTS.md - Motia Backend Codebase Guide

## Build & Test Commands
```bash
pnpm install               # Install dependencies (runs motia install post-install)
pnpm dev                   # Start development server (motia dev)
pnpm build                 # Build project (motia build)
pnpm test                  # Run all tests (requires: pnpm add -D @motiadev/test jest @types/jest)
jest path/to/test.spec.ts  # Run single test file
pnpm generate-types        # Generate TypeScript types (motia generate-types)
pnpm clean                 # Clean build artifacts (removes dist, node_modules, .motia)
```

## Code Style Guidelines
- **TypeScript**: Strict mode enabled, use type safety, prefer functional patterns
- **File Naming**: kebab-case for step files (`process-order.step.ts`), services (`pet-store.ts`)
- **Exports**: Named exports for configs (`export const config: ApiRouteConfig`), handlers (`export const handler`)
- **Imports**: Order: external packages → motia imports → local services → zod schemas
- **Error Handling**: Always use try/catch with `logger.error()` for proper tracing
- **State Management**: Scope with `traceId`, use hierarchical keys (`orders:${id}`, `user:${id}:profile`)
- **Validation**: Zod schemas for all inputs/outputs (`bodySchema`, `input`, `responseSchema`)
- **Logging**: Use context logger with structured data (`logger.info('Message', { data })`)
- **Testing**: Mock context with `@motiadev/test`, test emit/state/logger interactions

## Motia Architecture & Rules
Event-driven multi-language backend (JS/TS/Python/Ruby). Core: Steps→Topics→Flows.
Step types: API (HTTP endpoints), Event (async processing), Cron (scheduled), NOOP (virtual).
**IMPORTANT**: Only modify files in `steps/` folder - never touch package.json, tsconfig.json, types.d.ts.
See `.cursor/rules/` for detailed patterns: architecture, api-steps, event-steps, testing, typescript types.