import fs from 'node:fs/promises';
import path from 'node:path';

/** Max characters of extracted text kept per document. */
const MAX_CHARS = 60_000;

export type ExtractStatus = 'ok' | 'empty' | 'unsupported' | 'error';

export interface Extracted {
  text: string;
  status: ExtractStatus;
}

const TEXT_EXT = new Set(['.txt', '.md', '.csv', '.tsv', '.json', '.log']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

export function isImage(name: string, mime: string) {
  return mime.startsWith('image/') && IMAGE_EXT.has(path.extname(name).toLowerCase());
}
export function isPdf(name: string, mime: string) {
  return mime === 'application/pdf' || path.extname(name).toLowerCase() === '.pdf';
}

function clean(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_CHARS);
}

function decodeText(buf: Buffer) {
  const utf8 = buf.toString('utf8');
  // Files saved in Windows-1251 (old Notepad/Excel exports) decode to replacement chars as UTF-8.
  if ((utf8.match(/�/g) || []).length > 5) return new TextDecoder('windows-1251').decode(buf);
  return utf8.replace(/^﻿/, '');
}

function rtfToText(rtf: string) {
  return rtf
    .replace(/\\'([0-9a-f]{2})/gi, (_m, h) => new TextDecoder('windows-1251').decode(new Uint8Array([parseInt(h, 16)])))
    .replace(/\\u(-?\d+)\??/g, (_m, n) => String.fromCharCode(Number(n) < 0 ? Number(n) + 65536 : Number(n)))
    .replace(/\\par[d]?/g, '\n')
    .replace(/\{\\\*[^{}]*\}/g, '')
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '');
}

function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

/** Extracts plain text from an uploaded document so the AI can read it. */
export async function extractText(filePath: string, originalName: string, mime: string): Promise<Extracted> {
  const ext = path.extname(originalName).toLowerCase();
  try {
    const buf = await fs.readFile(filePath);
    let text: string | null = null;

    if (isPdf(originalName, mime)) {
      const { extractText: pdfText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const r = await pdfText(pdf, { mergePages: true });
      text = r.text as string;
    } else if (ext === '.docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const mammoth = await import('mammoth');
      text = (await mammoth.extractRawText({ buffer: buf })).value;
    } else if (ext === '.doc' || mime === 'application/msword') {
      const { default: WordExtractor } = await import('word-extractor');
      const doc = await new WordExtractor().extract(buf);
      text = doc.getBody();
    } else if (ext === '.rtf' || mime === 'application/rtf' || mime === 'text/rtf') {
      text = rtfToText(decodeText(buf));
    } else if (ext === '.html' || ext === '.htm') {
      text = htmlToText(decodeText(buf));
    } else if (TEXT_EXT.has(ext) || mime.startsWith('text/')) {
      text = decodeText(buf);
    }

    if (text === null) return { text: '', status: 'unsupported' };
    const t = clean(text);
    return { text: t, status: t ? 'ok' : 'empty' };
  } catch (e) {
    console.error(`Не удалось извлечь текст из «${originalName}»:`, (e as Error).message);
    return { text: '', status: 'error' };
  }
}

/** Renders the first pages of a scanned PDF to PNG so the AI can look at them like photos. */
export async function renderPdfPages(filePath: string, maxPages: number): Promise<Buffer[]> {
  const { getDocumentProxy, renderPageAsImage } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(await fs.readFile(filePath)));
  const pages: Buffer[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, maxPages); i++) {
    const png = await renderPageAsImage(pdf, i, { canvasImport: () => import('@napi-rs/canvas'), width: 1400 });
    pages.push(Buffer.from(png));
  }
  return pages;
}
