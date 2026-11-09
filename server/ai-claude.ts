import Anthropic from '@anthropic-ai/sdk';
import { ProxyAgent, fetch as undiciFetch } from 'undici';

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
      // undici's ProxyAgent only works with undici's own fetch, not Node's built-in one.
      ...(proxy ? { fetch: undiciFetch as unknown as typeof fetch, fetchOptions: { dispatcher: new ProxyAgent(proxy) } } : {}),
      timeout: 10 * 60 * 1000,
    });
  }
  return client;
}

export interface Attachment {
  kind: 'image' | 'pdf';
  mediaType: string;
  data: string; // base64
  name: string;
}

function attachmentBlocks(attachments: Attachment[]): Anthropic.Beta.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const a of attachments) {
    blocks.push({ type: 'text', text: `Файл из портфолио: «${a.name}»` });
    if (a.kind === 'image') {
      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type: a.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: a.data },
      });
    } else {
      blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.data } });
    }
  }
  return blocks;
}

/** Sends the prompt (plus images / scanned PDFs) to Claude and returns the answer text (expected to be JSON). */
export async function callClaude(system: string, user: string, attachments: Attachment[] = []): Promise<string> {
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
      messages: [{ role: 'user', content: [...attachmentBlocks(attachments), { type: 'text', text: user }] }],
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
