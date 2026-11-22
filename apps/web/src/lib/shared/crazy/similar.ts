/** The words of a title as a full-text query matching any of them, each as a prefix (#5). */
export function similarTsQuery(title: string): string | null {
  const words = [
    ...new Set(
      title
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 3)
    ),
  ].slice(0, 8)
  return words.length ? words.map((word) => `${word}:*`).join(' | ') : null
}
