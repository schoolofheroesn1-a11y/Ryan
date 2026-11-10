import fs from 'node:fs';
import path from 'node:path';
import { UPLOAD_DIR } from './db';
import { isImage, isPdf, renderPdfPages } from './extract';
import type { Attachment } from './ai-claude';

/** Images (certificates, student work) and scanned PDFs without a text layer — Claude looks at them directly. */
export async function mediaAttachments(files: any[], maxMedia = MAX_MEDIA): Promise<Attachment[]> {
  const out: Attachment[] = [];
  for (const f of files) {
    if (out.length >= maxMedia) break;
    const file = path.join(UPLOAD_DIR, path.basename(f.stored_name));
    try {
      if (isImage(f.original_name, f.mime) && f.size <= 3_700_000) {
        const data = fs.readFileSync(file).toString('base64');
        out.push({ kind: 'image', mediaType: f.mime === 'image/jpg' ? 'image/jpeg' : f.mime, data, name: f.original_name });
      } else if (isPdf(f.original_name, f.mime) && !f.extracted_text && f.size <= 30_000_000) {
        // A scan: render pages to PNG (works with every Claude-compatible API, including resellers).
        const pages = await renderPdfPages(file, Math.min(4, maxMedia - out.length));
        pages.forEach((png, i) =>
          out.push({ kind: 'image', mediaType: 'image/png', data: png.toString('base64'), name: `${f.original_name}, стр. ${i + 1}` }));
      }
    } catch (e) {
      console.error(`Не удалось подготовить «${f.original_name}» для ИИ:`, (e as Error).message);
    }
  }
  return out;
}


const MAX_MEDIA = 8;
