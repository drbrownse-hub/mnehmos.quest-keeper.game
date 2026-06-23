import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '../../../stores/settingsStore';
import { OpenAIProvider } from './OpenAIProvider';

const mockFetch = vi.fn();
const initialSettingsState = useSettingsStore.getState();

describe('OpenAIProvider routing', () => {
    beforeEach(() => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                choices: [{ message: { content: 'ok' } }],
            }),
        });
        vi.stubGlobal('fetch', mockFetch);
        useSettingsStore.setState({
            localOpenAIBaseUrl: 'http://127.0.0.1:11434/v1/chat/completions',
        });
    });

    afterEach(() => {
        useSettingsStore.setState(initialSettingsState, true);
        vi.unstubAllGlobals();
        vi.clearAllMocks();
        mockFetch.mockReset();
    });

    it('routes local-openai requests to the configured local OpenAI URL without OpenRouter headers', async () => {
        const provider = new OpenAIProvider('local-openai');
        const model = 'local/model:latest';

        await provider.sendMessage(
            [{ role: 'user', content: 'Hello' }],
            'ollama',
            model
        );

        expect(mockFetch).toHaveBeenCalledWith(
            'http://127.0.0.1:11434/v1/chat/completions',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    Authorization: 'Bearer ollama',
                }),
            })
        );

        const [, requestInit] = mockFetch.mock.calls[0];
        const body = JSON.parse(requestInit.body as string);

        expect(body.model).toBe(model);
        expect(requestInit.headers).not.toHaveProperty('HTTP-Referer');
        expect(requestInit.headers).not.toHaveProperty('X-Title');
    });

    it.each([
        ['openrouter provider', new OpenAIProvider('openrouter'), 'openai/gpt-oss-20b'],
        ['slash model', new OpenAIProvider('openai'), 'anthropic/claude-sonnet-4'],
    ])('routes %s requests to OpenRouter', async (_name, provider, model) => {
        await provider.sendMessage(
            [{ role: 'system', content: 'Use tools carefully.' }],
            'openrouter-key',
            model
        );

        expect(mockFetch).toHaveBeenCalledWith(
            'https://openrouter.ai/api/v1/chat/completions',
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer openrouter-key',
                    'HTTP-Referer': 'https://questkeeper.ai',
                    'X-Title': 'Quest Keeper AI',
                }),
            })
        );
    });
});
