/** Only pass supported, nonempty image sources into next/image. */
export function imageSource(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const source = value.trim();
  if (source.startsWith('/') && !source.startsWith('//')) return source;
  try {
    const url = new URL(source);
    return url.protocol === 'https:' || url.protocol === 'http:' ? source : undefined;
  } catch {
    return undefined;
  }
}

export function imageCandidates(src?: string | null, sources: string[] = []): string[] {
  return [...new Set([src, ...sources].map(imageSource).filter((source): source is string => !!source))];
}
