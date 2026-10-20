// Downloads Figma MCP asset URLs into a local folder.
// Usage: node scripts/fetch-figma-assets.mjs <outDir> <prefix> name=file [name=file...]
// e.g.   node scripts/fetch-figma-assets.mjs src/assets/icons https://…/a4c9 search=bd8c9.svg
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const [outDir, prefix, ...pairs] = process.argv.slice(2)
await mkdir(outDir, { recursive: true })
for (const pair of pairs) {
  const [name, file] = pair.split('=')
  const res = await fetch(`${prefix}/${file}`)
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`)
  const ext = path.extname(file)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(path.join(outDir, `${name}${ext}`), buf)
  console.log(`✓ ${name}${ext} (${buf.length} B)`)
}
