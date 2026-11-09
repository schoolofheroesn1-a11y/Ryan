import Anthropic from '@anthropic-ai/sdk';
import { ProxyAgent } from 'undici';

let client: Anthropic | null = null;

export function claudeModel() {
  return process.env.CLAUDE_MODEL || 'claude-opus-5-5';
}

function getClient() {
  if (!client) {
    const proxy = process.env.AI_PROXY;
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      // Optional outbound proxy (e.g. when the hosting region is not supported by the API).
      fetchOptions: proxy ? { dispatcher: new ProxyAgent(proxy) } : undefined,
      timeout: 5 * 60 * 1000,
    });
  }
  return client;
}

/** Sends the prompt to Claude and returns the text of the answer (expected to be JSON). */
export async function callClaude(system: string, user: string): Promise<string> {
  try {
    const stream = getClient().beta.messages.stream({
      model: claudeModel(),
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      // If the model declines, the API retries on a fallback model automatically.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages: [{ role: 'user', content: user }],
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') {
      throw new Error('Модель отказалась выполнять анализ. Попробуйте переформулировать запрос или убрать чувствительные детали из заметок.');
    }
    if (message.stop_reason === 'max_tokens') {
      throw new Error('Ответ модели оказался слишком длинным и был обрезан. Попробуйте ещё раз.');
    }
    const text = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    if (!text) throw new Error('Claude вернул пустой ответ');
    return text;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('Неверный ключ Anthropic API (ANTHROPIC_API_KEY)');
    if (e instanceof Anthropic.PermissionDeniedError)
      throw new Error('Anthropic API отклонил запрос (403). Возможно, регион сервера не поддерживается — задайте AI_PROXY или разместите сайт на зарубежном сервере.');
    if (e instanceof Anthropic.RateLimitError) throw new Error('Превышен лимит запросов к Claude. Попробуйте через минуту.');
    if (e instanceof Anthropic.APIConnectionError) throw new Error('Нет соединения с Anthropic API. Проверьте интернет на сервере или настройку AI_PROXY.');
    if (e instanceof Anthropic.APIError) throw new Error(`Ошибка Anthropic API (${e.status}): ${e.message}`);
    throw e;
  }
}
