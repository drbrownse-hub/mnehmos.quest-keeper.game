import React from 'react';
import { useSettingsStore, LLMProvider } from '../../stores/settingsStore';
import { ThemeSelector } from '../ThemeSelector';

export const SettingsView: React.FC = () => {
    const {
        apiKeys,
        selectedProvider,
        providerModels,
        systemPrompt,
        localOpenAIBaseUrl,
        setApiKey,
        setProvider,
        setModel,
        setLocalOpenAIBaseUrl,
        setSystemPrompt,
    } = useSettingsStore();

    // Theme-aware form element classes
    const inputClasses = "w-full rounded border border-terminal-green-dim bg-terminal-dim px-3 py-2 text-terminal-green focus:border-terminal-green-bright focus:outline-none";
    const selectClasses = "w-full rounded border border-terminal-green-dim bg-terminal-dim px-3 py-2 text-terminal-green focus:border-terminal-green-bright focus:outline-none";
    const apiKeyLabel = selectedProvider === 'local-openai'
        ? 'LOCAL API KEY (OPTIONAL)'
        : `${selectedProvider.toUpperCase()} API KEY`;
    const apiKeyPlaceholder = selectedProvider === 'local-openai'
        ? 'Optional dummy key, e.g. ollama'
        : `Enter ${selectedProvider} API Key`;

    return (
        <div className="flex items-center justify-center h-full w-full bg-terminal-black p-8">
            <div className="max-h-[calc(100vh-4rem)] w-full max-w-2xl overflow-y-auto rounded-lg border border-terminal-green-dim bg-terminal-dim p-8 shadow-lg">
                <div className="mb-8 border-b border-terminal-green-dim pb-4">
                    <h2 className="text-2xl font-bold text-terminal-green">⚙️ CONFIGURATION</h2>
                </div>

                <div className="space-y-6">
                    {/* Theme Selection */}
                    <ThemeSelector />

                    <div className="border-t border-terminal-green-dim my-4"></div>

                    {/* Provider Selection */}
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-terminal-green">API PROVIDER</label>
                        <select
                            value={selectedProvider}
                            onChange={(e) => setProvider(e.target.value as LLMProvider)}
                            className={selectClasses}
                        >
                            <option value="openai">OpenAI</option>
                            <option value="anthropic">Anthropic</option>
                            <option value="gemini">Google Gemini</option>
                            <option value="openrouter">OpenRouter</option>
                            <option value="local-openai">Local OpenAI Compatible</option>
                        </select>
                        <p className="text-xs text-terminal-green-dim">
                            This sets the active provider for all chat interactions.
                        </p>
                    </div>

                    {/* API Key */}
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-terminal-green">
                            {apiKeyLabel}
                        </label>
                        <input
                            type="password"
                            value={apiKeys[selectedProvider]}
                            onChange={(e) => setApiKey(selectedProvider, e.target.value)}
                            className={inputClasses}
                            placeholder={apiKeyPlaceholder}
                        />
                    </div>

                    {/* Model Selection */}
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-terminal-green">MODEL</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={providerModels[selectedProvider]}
                                onChange={(e) => setModel(selectedProvider, e.target.value)}
                                className={`flex-1 ${inputClasses}`}
                                placeholder="Select or type model ID"
                            />
                            <select
                                onChange={(e) => {
                                    if (e.target.value) setModel(selectedProvider, e.target.value);
                                }}
                                className="w-8 rounded border border-terminal-green-dim bg-terminal-dim px-1 text-terminal-green focus:border-terminal-green-bright focus:outline-none"
                                value=""
                            >
                                <option value="">▼</option>
                                {selectedProvider === 'openai' && (
                                    <>
                                        <optgroup label="GPT-5 Series">
                                            <option value="gpt-5.1">GPT-5.1</option>
                                            <option value="gpt-5-pro">GPT-5 Pro</option>
                                            <option value="gpt-5-mini">GPT-5 Mini</option>
                                            <option value="gpt-5-nano">GPT-5 Nano</option>
                                        </optgroup>
                                        <optgroup label="Reasoning">
                                            <option value="o4-mini">o4-mini</option>
                                            <option value="o3-mini">o3-mini</option>
                                        </optgroup>
                                        <optgroup label="Legacy">
                                            <option value="gpt-4o">GPT-4o</option>
                                        </optgroup>
                                    </>
                                )}
                                {selectedProvider === 'anthropic' && (
                                    <>
                                        <option value="claude-sonnet-4.5">Claude Sonnet 4.5</option>
                                        <option value="claude-3.7-sonnet">Claude 3.7 Sonnet</option>
                                        <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                                    </>
                                )}
                                {selectedProvider === 'openrouter' && (
                                    <>
                                        <optgroup label="Free / Free Tier">
                                            <option value="meta-llama/llama-3.2-3b-instruct:free">Llama 3.2 3B (Free)</option>
                                            <option value="google/gemini-2.0-flash-exp:free">Gemini 2.0 Flash Exp (Free)</option>
                                            <option value="deepseek/deepseek-r1:free">DeepSeek R1 (Free)</option>
                                            <option value="qwen/qwen3-coder:free">Qwen3 Coder (Free)</option>
                                        </optgroup>
                                        <optgroup label="Premium">
                                            <option value="anthropic/claude-opus-4.5">Claude Opus 4.5</option>
                                            <option value="anthropic/claude-haiku-4.5">Claude Haiku 4.5</option>
                                            <option value="anthropic/claude-sonnet-4.5">Claude Sonnet 4.5</option>
                                            <option value="openai/gpt-5.1">GPT-5.1</option>
                                            <option value="openai/gpt-5-nano">GPT-5 Nano</option>
                                            <option value="google/gemini-3-pro">Gemini 3 Pro</option>
                                        </optgroup>
                                    </>
                                )}
                                {selectedProvider === 'gemini' && (
                                    <>
                                        <option value="gemini-3-pro">Gemini 3 Pro</option>
                                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                    </>
                                )}
                                {selectedProvider === 'local-openai' && (
                                    <>
                                        <option value="igorls/gemma-4-E4B-it-heretic-GGUF:Q4_K_M">Gemma 4 E4B Heretic Q4_K_M</option>
                                        <option value="qwen3.5:4b">qwen3.5:4b</option>
                                        <option value="granite4.1:8b">granite4.1:8b</option>
                                        <option value="tinyq:latest">tinyq:latest</option>
                                    </>
                                )}
                            </select>
                        </div>
                    </div>

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

                    {/* System Prompt */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="block text-sm font-bold text-terminal-green">SYSTEM PROMPT</label>
                            <button
                                onClick={() => {
                                    // Clear settings and reload to get fresh default
                                    localStorage.removeItem('quest-keeper-settings');
                                    window.location.reload();
                                }}
                                className="text-xs px-2 py-1 border border-terminal-green-dim text-terminal-green-dim rounded hover:bg-terminal-green/20 hover:text-terminal-green transition-colors"
                            >
                                🔄 Reset to Default
                            </button>
                        </div>
                        <textarea
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            className="h-32 w-full rounded border border-terminal-green-dim bg-terminal-dim px-3 py-2 text-terminal-green focus:border-terminal-green-bright focus:outline-none"
                            placeholder="Define the AI's behavior..."
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
