## Task

Implement Ubuntu x86_64 `.deb` support and local inference support for `drbrownse-hub/mnehmos.quest-keeper.game`.

### Scope

Target:

```txt
Ubuntu x86_64 only
Package format: .deb only
Sidecar binaries: committed into this repo
Local inference: included
```

### Required repo changes

#### 1. Add Linux sidecar binaries

Build from the MCP repo:

```bash
git clone https://github.com/Mnehmos/mnehmos.rpg.mcp.git
cd mnehmos.rpg.mcp
npm install
npm run build:binaries
```

Then copy into this app repo:

```bash
mkdir -p src-tauri/binaries

cp ../mnehmos.rpg.mcp/bin/rpg-mcp-linux \
  src-tauri/binaries/rpg-mcp-server-x86_64-unknown-linux-gnu

cp ../mnehmos.rpg.mcp/bin/better_sqlite3-linux.node \
  src-tauri/binaries/better_sqlite3.node

chmod +x src-tauri/binaries/rpg-mcp-server-x86_64-unknown-linux-gnu
```

The MCP build script already has Linux deployment instructions matching this path and target triple.

#### 2. Update `src-tauri/tauri.conf.json`

Change bundle config from Windows-only installers to `.deb`, and point sidecar/resources into `binaries/`.

Recommended:

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

Current config only targets `nsis` and `msi`.

#### 3. Update `src-tauri/capabilities/default.json`

Replace Windows-only command permissions with the Linux sidecar path.

Recommended:

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

Remove these Windows-only entries:

```json
{
  "name": "rpg-mcp-server-direct",
  "cmd": "rpg-mcp-server.exe",
  "args": true
},
{
  "name": "run-cmd",
  "cmd": "cmd.exe",
  "args": true
}
```

They are currently present and Windows-specific.

#### 4. Update `src/services/mcpClient.ts`

Change sidecar launch from:

```ts
Command.sidecar(this.serverName, [], spawnOptions)
```

where `this.serverName` is currently `rpg-mcp-server`, to use the configured sidecar path:

```ts
const sidecarCmd = Command.sidecar('binaries/rpg-mcp-server', [], spawnOptions);
```

Then remove or guard the Windows fallback strategies:

```ts
Command.create('rpg-mcp-server-direct', ...)
Command.create('run-cmd', ['/c', 'rpg-mcp-server.exe'], ...)
```

Current code tries `.exe` and `cmd.exe` fallbacks.

For Ubuntu-only support, simplest is to remove the fallback strategies entirely and fail cleanly if the sidecar cannot spawn.

#### 5. Fix `scripts/prepare-mcp.js`

Current script checks:

```ts
src-tauri/better_sqlite3.node
```

but the intended Linux resource should be:

```ts
src-tauri/binaries/better_sqlite3.node
```

Update:

```ts
const srcNativeModule = join(projectRoot, 'src-tauri', 'binaries', 'better_sqlite3.node');
```

Also fix the error text, which currently incorrectly says `src-tauri/binaries/` while the code checks `src-tauri/`.

#### 6. Add `.github/workflows/release-linux.yml`

Use Ubuntu runner and build `.deb`.

Suggested workflow:

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

The existing release workflow is Windows-only and explicitly leaves Linux as future work.

---

## Local inference implementation

Add an OpenAI-compatible local provider. This covers both:

```txt
Ollama:    http://localhost:11434/v1/chat/completions
llama.cpp: http://localhost:8080/v1/chat/completions
```

### 1. Update `src/stores/settingsStore.ts`

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

Extend state:

```ts
localOpenAIBaseUrl: string;
setLocalOpenAIBaseUrl: (url: string) => void;
```

Extend `apiKeys` and `providerModels`:

```ts
apiKeys: {
  openai: string;
  anthropic: string;
  gemini: string;
  openrouter: string;
  'local-openai': string;
};

providerModels: {
  openai: string;
  anthropic: string;
  gemini: string;
  openrouter: string;
  'local-openai': string;
};
```

Defaults:

```ts
'local-openai': 'llama3.1'
localOpenAIBaseUrl: 'http://localhost:11434/v1/chat/completions'
```

API key can default to:

```ts
'local-openai': 'ollama'
```

### 2. Update `src/services/llm/LLMService.ts`

Add provider:

```ts
this.providers = {
  openai: new OpenAIProvider('openai'),
  openrouter: new OpenAIProvider('openrouter'),
  anthropic: new AnthropicProvider(),
  gemini: new GeminiProvider(),
  'local-openai': new OpenAIProvider('local-openai'),
};
```

Change `getApiKey()` so local provider does not require a real key:

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

The current implementation requires an API key for every provider.

### 3. Update `src/services/llm/providers/OpenAIProvider.ts`

Import settings:

```ts
import { useSettingsStore } from '../../../stores/settingsStore';
```

Change base URL selection:

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

Do this in both `sendMessage()` and `streamMessage()`.

The current provider hardcodes OpenAI/OpenRouter endpoints.

### 4. Add UI fields wherever provider/API settings are configured

Add provider option:

```txt
Local OpenAI Compatible
```

Show model field:

```txt
Model: llama3.1, qwen2.5, mistral, etc.
```

Show base URL field only for local provider:

```txt
Base URL: http://localhost:11434/v1/chat/completions
```

Hide “API key required” for local provider, or label it optional.

---

## README additions

Add an Ubuntu section:

````md
## Ubuntu x86_64 Installation

Download the `.deb` from Releases, then:

```bash
sudo apt install ./Quest.Keeper.AI_*_amd64.deb
````

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

```txt
src-tauri/binaries/rpg-mcp-server-x86_64-unknown-linux-gnu
src-tauri/binaries/better_sqlite3.node
```

````

Add local inference section:

```md
## Local Inference

Select `Local OpenAI Compatible` in settings.

For Ollama:

```bash
ollama serve
ollama pull llama3.1
````

Use:

```txt
Base URL: http://localhost:11434/v1/chat/completions
Model: llama3.1
API key: optional / dummy
```

For llama.cpp server:

```txt
Base URL: http://localhost:8080/v1/chat/completions
Model: any model name accepted by your server
```

````

---

## Validation checklist for Codex

Run on Ubuntu x86_64:

```bash
npm install
npm run prepare:mcp
npm run build
npm run tauri build
````

Then verify:

```bash
ls src-tauri/target/release/bundle/deb/*.deb
sudo apt install ./src-tauri/target/release/bundle/deb/*.deb
```

Runtime checks:

```txt
1. App launches.
2. MCP sidecar starts.
3. /test lists MCP tools.
4. OpenRouter/OpenAI still work.
5. Local OpenAI provider works with Ollama.
6. Tool calls still execute through MCP.
```

