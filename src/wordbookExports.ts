import type { WordRecord } from './readerDataTypes';

export function formatWordbookMarkdown(
  baseName: string,
  words: WordRecord[],
  exportedAt = new Date()
) {
  const lines = [
    `# Wordbook for ${baseName}`,
    '',
    `Exported at ${exportedAt.toISOString()}`,
    ''
  ];

  if (!words.length) {
    lines.push('No words saved yet.', '');
    return lines.join('\n');
  }

  for (const word of words) {
    const header = word.phonetic ? `## ${word.word} \`${word.phonetic}\`` : `## ${word.word}`;
    lines.push(header, '');
    if (word.translation) {
      lines.push(`- Meaning: ${word.translation}`);
    }
    if (word.definitions?.length) {
      for (const definition of word.definitions.slice(0, 6)) {
        const prefix = definition.pos ? `**${definition.pos}** ` : '';
        const text = definition.translation && definition.meaning
          ? `${definition.translation} (${definition.meaning})`
          : definition.translation || definition.meaning;
        lines.push(`  - ${prefix}${text}`);
      }
    }
    if (word.sentence && word.sentence.trim().toLowerCase() !== word.word.trim().toLowerCase()) {
      lines.push(`- Context: > ${word.sentence.replace(/\s+/g, ' ').trim()}`);
    }
    if (word.note?.trim()) {
      lines.push(`- Note: ${word.note.trim()}`);
    }
    if (word.page) {
      lines.push(`- Page: ${word.page}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function formatWordbookAnkiCsv(words: WordRecord[]) {
  const header = ['Word', 'Phonetic', 'Translation', 'Definitions', 'Sentence', 'Note', 'Page'];
  const rows = words.map(word => {
    const defs = (word.definitions || [])
      .slice(0, 5)
      .map(item => `${item.pos ? `${item.pos} ` : ''}${item.translation || item.meaning}`.trim())
      .filter(Boolean)
      .join(' | ');
    const sentence = word.sentence && word.sentence.trim().toLowerCase() !== word.word.trim().toLowerCase()
      ? word.sentence.replace(/\s+/g, ' ').trim()
      : '';
    return [
      word.word,
      word.phonetic || '',
      word.translation || '',
      defs,
      sentence,
      word.note?.trim() || '',
      word.page ? String(word.page) : ''
    ];
  });
  return [header, ...rows].map(row => row.map(escapeCsvCell).join(',')).join('\n') + '\n';
}

function escapeCsvCell(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
