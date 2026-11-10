/** Replaces the student's surname and first name (in any grammatical case) with «Ученик». */
export function nameRedactor(fullName: string) {
  const words = fullName.split(/\s+/).filter((w) => w.length >= 3);
  if (!words.length) return (t: string) => t;
  const stems = words.map((w) => {
    const stem = /[аеёиоуыэюяйь]$/i.test(w) && w.length >= 4 ? w.slice(0, -1) : w;
    return stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  const re = new RegExp(`(?<![\\p{L}])(?:${stems.join('|')})\\p{L}{0,3}(?![\\p{L}])`, 'giu');
  return (t: string) => t.replace(re, 'Ученик');
}

