# Ubuntu .deb Packaging and Local Inference Design

## Goal

Convert this branch of Quest Keeper AI to Ubuntu x86_64 `.deb` packaging and add an OpenAI-compatible local inference provider. Windows packaging and runtime fallback support are intentionally out of scope for this branch.

## Scope

- Target platform: Ubuntu x86_64.
- Package format: `.deb` only.
- Sidecar binaries: built from `https://github.com/Mnehmos/mnehmos.rpg.mcp.git` and committed into this repository.
- Local inference: support OpenAI-compatible chat completions endpoints such as Ollama and llama.cpp server.

## Packaging Architecture

Linux MCP artifacts will be produced from the MCP repository with `npm install` and `npm run build:binaries`, then copied into this app repository:

- `src-tauri/binaries/rpg-mcp-server-x86_64-unknown-linux-gnu`
- `src-tauri/binaries/better_sqlite3.node`

The Tauri bundle config will become Ubuntu-only:

- `bundle.targets`: `["deb"]`
- `bundle.externalBin`: `["binaries/rpg-mcp-server"]`
- `bundle.resources`: `["binaries/better_sqlite3.node"]`

The Tauri capability file will allow only the Linux sidecar path and remove Windows-only `rpg-mcp-server.exe` and `cmd.exe` permissions.

## Runtime Sidecar Flow

`src/services/mcpClient.ts` will launch one configured sidecar:

```ts
Command.sidecar('binaries/rpg-mcp-server', [], spawnOptions)
```

The existing native-module copy behavior remains, but `scripts/prepare-mcp.js` will use `src-tauri/binaries/better_sqlite3.node` as the source of truth. Windows direct execution and `cmd.exe` fallback strategies will be removed. If the sidecar cannot spawn, the client will log a clear fatal error and surface the failure.

## Local Inference Flow

`settingsStore` will add `local-openai` to `LLMProvider`, with defaults:

- model: `llama3.1`
- base URL: `http://localhost:11434/v1/chat/completions`
- API key: `ollama`

`LLMService` will register `local-openai` through `OpenAIProvider` and skip the real API-key requirement for that provider. `OpenAIProvider` will choose the base URL from settings when provider is `local-openai`; OpenAI and OpenRouter routing remains unchanged.

Both settings surfaces, `src/components/settings/SettingsModal.tsx` and `src/components/viewport/SettingsView.tsx`, will add `Local OpenAI Compatible`, a model field, and a local-only base URL field. The API key field will be optional or clearly labeled as dummy/optional for local inference.

## Release Workflow

Add `.github/workflows/release-linux.yml` using an Ubuntu runner. It will install Node 20, Rust stable, Tauri Linux prerequisites, run `npm ci`, verify the committed Linux sidecar files, run `npm run prepare:mcp`, build with `npm run tauri build`, and upload `src-tauri/target/release/bundle/deb/*.deb`.

## Documentation

`README.md` will gain:

- Ubuntu x86_64 installation with `sudo apt install ./Quest.Keeper.AI_*_amd64.deb`.
- Development prerequisites for Tauri on Ubuntu.
- Expected sidecar paths.
- Local inference setup for Ollama and llama.cpp server.

## Validation

Primary validation on Ubuntu x86_64:

```bash
npm install
npm run prepare:mcp
npm run build
npm run tauri build
ls src-tauri/target/release/bundle/deb/*.deb
```

Runtime checks:

- App launches.
- MCP sidecar starts.
- `/test` lists MCP tools.
- OpenAI/OpenRouter behavior still works.
- Local OpenAI provider works with Ollama.
- Tool calls still execute through MCP.

## Risks and Constraints

- Building MCP binaries requires network access and the external MCP repository build to succeed.
- Committed binaries increase repository size but make app builds reproducible from this repository alone.
- Local models may not support tool calling consistently; failures should surface as provider/model capability issues rather than MCP failures.
