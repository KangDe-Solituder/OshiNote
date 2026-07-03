export interface TextStats {
  characters: number
  words: number
}

const CJK_RANGES = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/u
const WORD_LIKE = /[\p{L}\p{N}]/u

export function countTextStats(text: string): TextStats {
  const normalized = text.replace(/\r\n?/g, '\n')
  const characters = Array.from(normalized).length
  let words = 0
  let inWord = false

  for (const char of normalized) {
    if (CJK_RANGES.test(char)) {
      words += 1
      inWord = false
      continue
    }

    if (WORD_LIKE.test(char)) {
      if (!inWord) words += 1
      inWord = true
      continue
    }

    inWord = false
  }

  return { characters, words }
}
