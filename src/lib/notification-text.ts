/** Extract readable text from Editor.js content without inserting server HTML. */
export function notificationText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try { return notificationText(JSON.parse(trimmed)); } catch { return ''; }
    }
    const entities: Record<string, string> = {nbsp:' ',amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',ndash:'–',mdash:'—',laquo:'«',raquo:'»',hellip:'…'};
    return value.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
        if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? match;
        const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2),16) : Number(entity.slice(1));
        return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
      }).replace(/[ \t\u00a0]+/g,' ').replace(/ *\n */g,'\n').trim();
  }
  if (Array.isArray(value)) return value.map(notificationText).filter(Boolean).join('\n');
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.blocks)) return obj.blocks.map(block => {
      const b = block as {type?: string; data?: {text?: unknown; items?: unknown}};
      if (['paragraph','header','quote','warning'].includes(b?.type || '')) return notificationText(b.data?.text);
      if (b?.type === 'list') return notificationText(b.data?.items);
      return '';
    }).filter(Boolean).join('\n\n');
    if (typeof obj.content === 'string') return notificationText(obj.content);
    if (typeof obj.text === 'string') return notificationText(obj.text);
  }
  return '';
}
