# Repository Guidelines

## Project Structure & Module Organization

Quest Keeper AI is a React 19 + TypeScript desktop app packaged with Tauri 2. Frontend code lives in `src/`: UI in `src/components/`, Zustand stores in `src/stores/`, LLM and MCP integration in `src/services/`, hooks in `src/hooks/`, utilities in `src/utils/`, and test setup/mocks in `src/test/`. Tauri/Rust configuration and sidecar assets live in `src-tauri/`. Static assets are in `public/`; planning and architecture notes are in `docs/`.

## Build, Test, and Development Commands

- `npm install`: install JavaScript dependencies.
- `npm run dev`: prepare the MCP sidecar and start Vite for web-only development.
- `npm run tauri dev`: run the full desktop app with Tauri APIs and sidecar behavior.
- `npm run build`: run `prepare:mcp`, TypeScript checks, and the Vite production build.
- `npm run tauri build`: create the production desktop bundle.
- `npm test`: run the Vitest suite once.
- `npm run test:coverage`: generate V8 coverage reports.

## Coding Style & Naming Conventions

TypeScript is strict (`noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch` are enabled). Use React function components, hooks, and existing store/service patterns. Name components and files in PascalCase, such as `CombatHUD.tsx`; hooks start with `use`; stores use lower camel case plus `Store`, such as `hudStore.ts`. Prefer the `@/` alias for `src` imports when it improves readability. Keep formatting consistent with nearby code.

## Testing Guidelines

Vitest runs in `jsdom` with Testing Library helpers from `src/test/setup.ts`. Place tests beside the code they cover using `*.test.ts` or `*.test.tsx`; examples include `src/stores/hudStore.test.ts` and `src/components/hud/CombatHUD.test.tsx`. Mock Tauri and MCP APIs through `src/test/mocks/`. Add focused coverage before changing shared services or game-state flows.

## Commit & Pull Request Guidelines

Recent commits use short imperative summaries, often with Conventional Commit prefixes such as `feat:` and `fix:`. Keep commits scoped, for example `fix: update CombatHUD tests for v0.1.1`. Pull requests should describe the user-visible change, list verification commands, link issues or plans, and include screenshots for UI changes.

## Security & Configuration Tips

Do not commit user API keys or local secrets. Provider keys are configured in-app and stored in localStorage. Treat `.env.production`, `.env.staging`, Tauri capabilities, and the MCP sidecar path as release-sensitive; verify them before packaging.
