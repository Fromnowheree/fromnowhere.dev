/** Minimal builder for Lexical rich text, used only to write seed content readably. */
type Block = string | { h2: string } | { h3: string } | { ul: string[] } | { quote: string }

const base = { format: '' as const, indent: 0, version: 1, direction: 'ltr' as const }

const text = (value: string) => ({
  type: 'text',
  text: value,
  format: 0,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})

const toNode = (block: Block) => {
  if (typeof block === 'string') {
    return { ...base, type: 'paragraph', textFormat: 0, textStyle: '', children: [text(block)] }
  }
  if ('h2' in block) return { ...base, type: 'heading', tag: 'h2', children: [text(block.h2)] }
  if ('h3' in block) return { ...base, type: 'heading', tag: 'h3', children: [text(block.h3)] }
  if ('quote' in block) return { ...base, type: 'quote', children: [text(block.quote)] }
  return {
    ...base,
    type: 'list',
    listType: 'bullet',
    start: 1,
    tag: 'ul',
    children: block.ul.map((item, i) => ({
      ...base,
      type: 'listitem',
      value: i + 1,
      children: [text(item)],
    })),
  }
}

export const richText = (blocks: Block[]) => ({
  root: { ...base, type: 'root', children: blocks.map(toNode) },
})
