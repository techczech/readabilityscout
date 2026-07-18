// Text extraction for non-plain-text formats. The source file is only ever
// read (ADR 0002); extraction happens in memory in the main process.
import { unzipSync, strFromU8 } from 'fflate'
import { getDocumentProxy } from 'unpdf'

export type ExtractedFormat = 'pdf' | 'docx'

export function formatForPath(path: string): ExtractedFormat | 'doc-legacy' | null {
  const ext = path.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'doc') return 'doc-legacy'
  return null
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

// .docx is a zip of XML; the prose lives in word/document.xml as <w:p> paragraphs.
export function extractDocx(buf: Buffer): string {
  const files = unzipSync(new Uint8Array(buf))
  const documentXml = files['word/document.xml']
  if (!documentXml) throw new Error('word/document.xml missing')
  let xml = strFromU8(documentXml)
  xml = xml
    .replace(/<w:tab\s*\/>/g, '\t')
    .replace(/<w:br\s*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n\n')
    .replace(/<[^>]+>/g, '')
  return decodeXmlEntities(xml)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

type PdfTextItem = { str: string; transform: number[]; width?: number }

// pdfjs text runs arrive without line structure; rebuild lines by y-coordinate
// (PDF origin is bottom-left, so larger y = higher on the page) and insert
// spaces where the x-gap between runs indicates one.
export async function extractPdf(buf: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buf))
  const out: string[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()
    const items = (tc.items as unknown as PdfTextItem[]).filter((i) => typeof i.str === 'string' && i.str.trim().length > 0)
    const lines = new Map<number, PdfTextItem[]>()
    items.forEach((it) => {
      const y = Math.round(it.transform[5])
      let key = [...lines.keys()].find((k) => Math.abs(k - y) <= 2)
      if (key === undefined) {
        key = y
        lines.set(key, [])
      }
      lines.get(key)!.push(it)
    })
    const sorted = [...lines.entries()].sort((a, b) => b[0] - a[0])
    for (const [, lineItems] of sorted) {
      lineItems.sort((a, b) => a.transform[4] - b.transform[4])
      let line = ''
      let prevEnd = 0
      lineItems.forEach((it, idx) => {
        if (idx > 0) {
          const gap = it.transform[4] - prevEnd
          if (gap > 1 && !line.endsWith(' ') && !it.str.startsWith(' ')) line += ' '
        }
        line += it.str
        prevEnd = it.transform[4] + (it.width ?? it.str.length * 5)
      })
      out.push(line.trim())
    }
    out.push('') // page break becomes a paragraph break
  }
  return out
    .join('\n')
    .replace(/(\w)-\n(\w)/g, '$1$2') // rejoin words hyphenated at line ends
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
