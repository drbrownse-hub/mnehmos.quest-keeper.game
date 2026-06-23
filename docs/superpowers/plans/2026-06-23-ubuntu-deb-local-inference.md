# Ubuntu .deb Local Inference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert this branch to Ubuntu x86_64 `.deb` packaging with committed Linux MCP sidecars and an OpenAI-compatible local inference provider.

**Architecture:** Tauri packaging becomes Ubuntu-only, with sidecars stored under `src-tauri/binaries/` and launched through one configured sidecar path. Local inference reuses the existing `OpenAIProvider` by adding a `local-openai` provider, local base URL setting, and optional dummy API key.

**Tech Stack:** React 19, TypeScript, Zustand, Vitest, Tauri 2, GitHub Actions, Node 20, Rust stable.

---

## File Map

- Modify `src-tauri/tauri.conf.json`: switch bundle target to `.deb` and use `binaries/` paths.
- Modify `src-tauri/capabilities/default.json`: allow only the Linux sidecar.
- Modify `scripts/prepare-mcp.js`: source `better_sqlite3.node` from `src-tauri/binaries/`.
- Modify `src/services/mcpClient.ts`: remove Windows fallback strategies and spawn `binaries/rpg-mcp-server`.
- Modify `src/stores/settingsStore.ts`: add `local-openai`, base URL state, defaults, and setter.
- Modify `src/services/llm/LLMService.ts`: register local provider and allow dummy local key.
- Modify `src/services/llm/providers/OpenAIProvider.ts`: choose local base URL from settings.
- Modify `src/components/settings/SettingsModal.tsx`: add local provider option and base URL field.
- Modify `src/components/viewport/SettingsView.tsx`: mirror settings modal changes.
- Create `src/services/llm/providers/OpenAIProvider.test.ts`: verify endpoint routing and local auth behavior.
- Create `.github/workflows/release-linux.yml`: build and upload `.deb`.
- Modify `.github/workflows/ci.yml`: run Linux CI for this Ubuntu-only branch.
- Modify `README.md`: document Ubuntu install/dev and local inference.
- Add `src-tauri/binaries/rpg-mcp-server-x86_64-unknown-linux-gnu`: committed Linux sidecar executable.
- Add `src-tauri/binaries/better_sqlite3.node`: committed Linux native SQLite module.

## Task 1: Build and Stage Linux MCP Artifacts

**Files:**
- Create: `src-tauri/binaries/rpg-mcp-server-x86_64-unknown-linux-gnu`
- Create/Replace: `src-tauri/binaries/better_sqlite3.node`

- [ ] **Step 1: Clone and build MCP repo outside the app repo**

Run from `/home/niic/codex/dnd-ai`:

```bash
git clone https://github.com/Mnehmos/mnehmos.rpg.mcp.git
cd mnehmos.rpg.mcp
npm install
npm run build:binaries
```

Expected: `bin/rpg-mcp-linux` and `bin/better_sqlite3-linux.node` exist.

- [ ] **Step 2: Copy artifacts into this app repo**

Run from `/home/niic/codex/dnd-ai/mnehmos.quest-keeper.game`:

```bash
mkdir -p src-tauri/binaries
cp ../mnehmos.rpg.mcp/bin/rpg-mcp-linux src-tauri/binaries/rpg-mcp-server-x86_64-unknown-linux-gnu
cp ../mnehmos.rpg.mcp/bin/better_sqlite3-linux.node src-tauri/binaries/better_sqlite3.node
chmod +x src-tauri/binaries/rpg-mcp-server-x86_64-unknown-linux-gnu
```

Expected: both files are present and the sidecar is executable.

- [ ] **Step 3: Verify artifact shape**

Run:

```bash
test -x src-tauri/binaries/rpg-mcp-server-x86_64-unknown-linux-gnu
test -f src-tauri/binaries/better_sqlite3.node
file src-tauri/binaries/rpg-mcp-server-x86_64-unknown-linux-gnu
file src-tauri/binaries/better_sqlite3.node
```

Expected: executable reports Linux x86-64; native module reports ELF shared object.

- [ ] **Step 4: Local checkpoint**

Run:

```bash
git status --short
```

Expected: the two `src-tauri/binaries/` files are shown as added or modified. Commit is deferred until Git identity is configured.

## Task 2: Convert Tauri Packaging and Capabilities to Ubuntu-only

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `scripts/prepare-mcp.js`

- [ ] **Step 1: Update Tauri bundle config**

In `src-tauri/tauri.conf.json`, replace the `bundle` block with:

```json
"bundle": {
  "active": true,
  "targets": ["deb"],
  "externalBin": [
    "binaries/rpg-mcp-server"
  ],
  "resources": [
    "binaries/better_sqlite3.node"
  ],
  "icon": [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.icns",
    "icons/icon.ico"
  ]
}
```

- [ ] **Step 2: Update shell capability**

In `src-tauri/capabilities/default.json`, replace the `shell:allow-spawn` allow list with:

```json
{
  "identifier": "shell:allow-spawn",
  "allow": [
    {
      "name": "binaries/rpg-mcp-server",
      "sidecar": true
    }
  ]
}
```

Keep the existing non-Windows permissions such as `core:default`, `shell:allow-stdin-write`, and filesystem permissions.

- [ ] **Step 3: Fix native module preparation path**

In `scripts/prepare-mcp.js`, set:

```js
const srcNativeModule = join(projectRoot, 'src-tauri', 'binaries', 'better_sqlite3.node');
```

Keep target paths as `src-tauri/target/debug/better_sqlite3.node` and `src-tauri/target/release/better_sqlite3.node`. Update the error text so it names `src-tauri/binaries/better_sqlite3.node`.

- [ ] **Step 4: Verify config syntax**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json','utf8')); JSON.parse(require('fs').readFileSync('src-tauri/capabilities/default.json','utf8'))"
npm run prepare:mcp
```

Expected: JSON parsing succeeds, and `prepare:mcp` copies the native module to debug and release target directories.

## Task 3: Simplify MCP Sidecar Launch for Linux

**Files:**
- Modify: `src/services/mcpClient.ts`

- [ ] **Step 1: Replace sidecar command name**

In `connect()`, replace:

```ts
const sidecarCmd = Command.sidecar(this.serverName, [], spawnOptions);
```

with:

```ts
const sidecarCmd = Command.sidecar('binaries/rpg-mcp-server', [], spawnOptions);
```

- [ ] **Step 2: Remove Windows fallback strategies**

Delete the blocks that call:

```ts
Command.create('rpg-mcp-server-direct', [], spawnOptions);
Command.create('run-cmd', ['/c', 'rpg-mcp-server.exe'], spawnOptions);
```

After the sidecar catch block, throw a new error:

```ts
throw new Error(`Failed to spawn Linux MCP sidecar binaries/rpg-mcp-server: ${sidecarError}`);
```

- [ ] **Step 3: Preserve diagnostics**

Keep existing `logToFile()` calls around sidecar failure and fatal connection failure. The resulting path should log Strategy 1 failure, then a fatal error from the outer catch.

- [ ] **Step 4: Run type/build check for this file**

Run:

```bash
npm run build
```

Expected: TypeScript succeeds. If Vite build fails because Tauri packaging prerequisites are missing, record the exact error and continue with `npm test` after TypeScript errors are resolved.

## Task 4: Add Settings State for Local OpenAI Provider

**Files:**
- Modify: `src/stores/settingsStore.ts`
- Test: use existing store tests as pattern; add test coverage only if a clean reset helper is already practical.

- [ ] **Step 1: Extend provider type**

Change:

```ts
export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'openrouter';
```

to:

```ts
export type LLMProvider =
    | 'openai'
    | 'anthropic'
    | 'gemini'
    | 'openrouter'
    | 'local-openai';
```

- [ ] **Step 2: Extend settings state interface**

Add `local-openai` keys and base URL fields:

```ts
localOpenAIBaseUrl: string;
setLocalOpenAIBaseUrl: (url: string) => void;
```

Extend `apiKeys` and `providerModels` with:

```ts
'local-openai': string;
```

- [ ] **Step 3: Add defaults and setter**

In the persisted store defaults, add:

```ts
apiKeys: {
    openai: '',
    anthropic: '',
    gemini: '',
    openrouter: '',
    'local-openai': 'ollama',
},
providerModels: {
    openai: 'gpt-4.1',
    anthropic: 'claude-sonnet-4-5-20250514',
    gemini: 'gemini-2.0-flash',
    openrouter: 'anthropic/claude-haiku-4.5',
    'local-openai': 'llama3.1',
},
localOpenAIBaseUrl: 'http://localhost:11434/v1/chat/completions',
setLocalOpenAIBaseUrl: (url) => set({ localOpenAIBaseUrl: url }),
```

- [ ] **Step 4: Verify type safety**

Run:

```bash
npm run build
```

Expected: no TypeScript errors from indexed access such as `apiKeys[selectedProvider]` or `providerModels[selectedProvider]`.

## Task 5: Add Local Provider Routing and Tests

**Files:**
- Modify: `src/services/llm/LLMService.ts`
- Modify: `src/services/llm/providers/OpenAIProvider.ts`
- Create: `src/services/llm/providers/OpenAIProvider.test.ts`

- [ ] **Step 1: Write endpoint routing tests**

Create `src/services/llm/providers/OpenAIProvider.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAIProvider } from './OpenAIProvider';
import { useSettingsStore } from '../../../stores/settingsStore';

describe('OpenAIProvider endpoint routing', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        useSettingsStore.setState({
            localOpenAIBaseUrl: 'http://localhost:11434/v1/chat/completions',
        });
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
        }) as any;
    });

    it('uses the configured local OpenAI-compatible base URL', async () => {
        const provider = new OpenAIProvider('local-openai');

        await provider.sendMessage([{ role: 'user', content: 'hello' }], 'ollama', 'llama3.1');

        expect(global.fetch).toHaveBeenCalledWith(
            'http://localhost:11434/v1/chat/completions',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    Authorization: 'Bearer ollama',
                }),
            })
        );
    });

    it('keeps OpenRouter routing for slash models', async () => {
        const provider = new OpenAIProvider('openai');

        await provider.sendMessage([{ role: 'user', content: 'hello' }], 'key', 'anthropic/claude-haiku-4.5');

        expect(global.fetch).toHaveBeenCalledWith(
            'https://openrouter.ai/api/v1/chat/completions',
            expect.any(Object)
        );
    });
});
```

- [ ] **Step 2: Run tests to verify failure before implementation**

Run:

```bash
npm test -- src/services/llm/providers/OpenAIProvider.test.ts
```

Expected before implementation: local provider test fails because `local-openai` is not typed or route is not used.

- [ ] **Step 3: Register provider and dummy local key**

In `src/services/llm/LLMService.ts`, add:

```ts
'local-openai': new OpenAIProvider('local-openai'),
```

Change `getApiKey()`:

```ts
private getApiKey(): string {
    const { apiKeys, selectedProvider } = useSettingsStore.getState();

    if (selectedProvider === 'local-openai') {
        return apiKeys[selectedProvider] || 'ollama';
    }

    const key = apiKeys[selectedProvider];
    if (!key) {
        throw new Error(`API Key for ${selectedProvider} is missing. Please configure it in settings.`);
    }
    return key;
}
```

- [ ] **Step 4: Route local OpenAI provider**

In `src/services/llm/providers/OpenAIProvider.ts`, import settings:

```ts
import { useSettingsStore } from '../../../stores/settingsStore';
```

In both `sendMessage()` and `streamMessage()`, use this base URL selection:

```ts
let baseUrl = 'https://api.openai.com/v1/chat/completions';

if (this.provider === 'local-openai') {
    baseUrl = useSettingsStore.getState().localOpenAIBaseUrl;
} else if (model.includes('/') || this.provider === 'openrouter') {
    baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
    headers['HTTP-Referer'] = 'https://questkeeper.ai';
    headers['X-Title'] = 'Quest Keeper AI';
}
```

- [ ] **Step 5: Run provider tests**

Run:

```bash
npm test -- src/services/llm/providers/OpenAIProvider.test.ts
```

Expected: both tests pass.

## Task 6: Add Local Provider Fields to Settings UI

**Files:**
- Modify: `src/components/settings/SettingsModal.tsx`
- Modify: `src/components/viewport/SettingsView.tsx`

- [ ] **Step 1: Read new state fields in both components**

Add to destructuring in both files:

```ts
localOpenAIBaseUrl,
setLocalOpenAIBaseUrl,
```

- [ ] **Step 2: Add provider option in both provider selects**

Add:

```tsx
<option value="local-openai">Local OpenAI Compatible</option>
```

- [ ] **Step 3: Label API key as optional for local provider**

Change label expression to:

```tsx
{selectedProvider === 'local-openai' ? 'LOCAL API KEY (OPTIONAL)' : `${selectedProvider.toUpperCase()} API KEY`}
```

Change placeholder to:

```tsx
placeholder={selectedProvider === 'local-openai' ? 'Optional dummy key, e.g. ollama' : `Enter ${selectedProvider} API Key`}
```

- [ ] **Step 4: Add local model presets in both dropdowns**

Add a local provider branch:

```tsx
{selectedProvider === 'local-openai' && (
    <>
        <option value="llama3.1">llama3.1</option>
        <option value="qwen2.5">qwen2.5</option>
        <option value="mistral">mistral</option>
    </>
)}
```

- [ ] **Step 5: Add local-only base URL field in both components**

Place after model selection:

```tsx
{selectedProvider === 'local-openai' && (
    <div className="space-y-2">
        <label className="block text-sm font-bold text-terminal-green">BASE URL</label>
        <input
            type="text"
            value={localOpenAIBaseUrl}
            onChange={(e) => setLocalOpenAIBaseUrl(e.target.value)}
            className={inputClasses}
            placeholder="http://localhost:11434/v1/chat/completions"
        />
        <p className="text-xs text-terminal-green-dim">
            Use Ollama, llama.cpp server, or any OpenAI-compatible chat completions endpoint.
        </p>
    </div>
)}
```

For `SettingsModal.tsx`, use its existing input class string instead of `inputClasses`, because that component does not currently define shared class constants.

- [ ] **Step 6: Run build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build pass.

## Task 7: Linux CI, Release Workflow, and README

**Files:**
- Create: `.github/workflows/release-linux.yml`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

- [ ] **Step 1: Add release workflow**

Create `.github/workflows/release-linux.yml` with:

```yaml
name: Release Linux

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-linux:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install Tauri Linux prerequisites
        run: |
          sudo apt update
          sudo apt install -y \
            libwebkit2gtk-4.1-dev \
            build-essential \
            curl \
            wget \
            file \
            libxdo-dev \
            libssl-dev \
            libayatana-appindicator3-dev \
            librsvg2-dev

      - name: Install dependencies
        run: npm ci

      - name: Verify Linux sidecar and native module
        run: |
          test -f src-tauri/binaries/rpg-mcp-server-x86_64-unknown-linux-gnu
          test -f src-tauri/binaries/better_sqlite3.node
          chmod +x src-tauri/binaries/rpg-mcp-server-x86_64-unknown-linux-gnu

      - name: Prepare native module
        run: npm run prepare:mcp

      - name: Build Tauri .deb
        run: npm run tauri build

      - name: Upload Linux artifacts
        uses: actions/upload-artifact@v4
        with:
          name: quest-keeper-ai-linux-x64-deb
          path: src-tauri/target/release/bundle/deb/*.deb
```

- [ ] **Step 2: Convert CI to Ubuntu**

In `.github/workflows/ci.yml`, change both jobs to `runs-on: ubuntu-latest`, remove Windows Rust target setup, and add a sidecar existence check before `npm run build`:

```yaml
- name: Verify Linux sidecar and native module
  run: |
    test -f src-tauri/binaries/rpg-mcp-server-x86_64-unknown-linux-gnu
    test -f src-tauri/binaries/better_sqlite3.node
    chmod +x src-tauri/binaries/rpg-mcp-server-x86_64-unknown-linux-gnu
```

- [ ] **Step 3: Add README Ubuntu installation section**

Add:

````md
## Ubuntu x86_64 Installation

Download the `.deb` from Releases, then:

```bash
sudo apt install ./Quest.Keeper.AI_*_amd64.deb
```

For development:

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

npm install
npm run tauri dev
```

The Linux MCP sidecar must exist at:

```text
src-tauri/binaries/rpg-mcp-server-x86_64-unknown-linux-gnu
src-tauri/binaries/better_sqlite3.node
```
````

- [ ] **Step 4: Add README local inference section**

Add:

````md
## Local Inference

Select `Local OpenAI Compatible` in settings.

For Ollama:

```bash
ollama serve
ollama pull llama3.1
```

Use:

```text
Base URL: http://localhost:11434/v1/chat/completions
Model: llama3.1
API key: optional / dummy
```

For llama.cpp server:

```text
Base URL: http://localhost:8080/v1/chat/completions
Model: any model name accepted by your server
```
````

- [ ] **Step 5: Run workflow syntax sanity check**

Run:

```bash
node -e "require('fs').readFileSync('.github/workflows/release-linux.yml','utf8').includes('ubuntu-latest') || process.exit(1)"
```

Expected: command exits 0. Full GitHub Actions validation occurs remotely.

## Task 8: Final Verification

**Files:**
- All changed files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- src/services/llm/providers/OpenAIProvider.test.ts
```

Expected: provider routing tests pass.

- [ ] **Step 2: Run full tests**

Run:

```bash
npm test
```

Expected: all Vitest tests pass.

- [ ] **Step 3: Run production web build**

Run:

```bash
npm run build
```

Expected: `prepare:mcp`, TypeScript, and Vite build pass.

- [ ] **Step 4: Run Tauri .deb build on Ubuntu**

Run:

```bash
npm run tauri build
ls src-tauri/target/release/bundle/deb/*.deb
```

Expected: a `.deb` artifact exists.

- [ ] **Step 5: Manual runtime checks**

On Ubuntu x86_64:

```bash
sudo apt install ./src-tauri/target/release/bundle/deb/*.deb
```

Then verify in the app:

- App launches.
- MCP sidecar starts.
- `/test` lists MCP tools.
- OpenAI or OpenRouter still works.
- `Local OpenAI Compatible` works with Ollama at `http://localhost:11434/v1/chat/completions`.
- Tool calls still execute through MCP.

- [ ] **Step 6: Local checkpoint**

Run:

```bash
git status --short
```

Expected: implementation files and committed binaries are visible. Commit remains deferred until Git identity is configured.
