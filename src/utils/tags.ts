const TAG_PATTERN = /(^|\s)#([a-zA-Z0-9][a-zA-Z0-9-_]*)/g;

export const normalizeTag = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '');

export const extractHashTags = (content: string): string[] => {
  const tags = new Set<string>();
  const text = String(content || '');

  for (const match of text.matchAll(TAG_PATTERN)) {
    const normalized = normalizeTag(match[2] || '');
    if (normalized) tags.add(normalized);
  }

  return Array.from(tags);
};
