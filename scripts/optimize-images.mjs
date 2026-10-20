// Generates responsive WebP renditions of the Figma source images.
// Sources: assets-src/figma/*.png (exported from the Figma file, untouched).
// Output:  public/nfts/<name>-<width>.webp
import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const SRC = 'assets-src/figma'
const OUT = 'public/nfts'
const WIDTHS = [160, 320, 640, 960]

await mkdir(OUT, { recursive: true })
for (const file of await readdir(SRC)) {
  if (!file.endsWith('.png')) continue
  const name = path.basename(file, '.png')
  for (const w of WIDTHS) {
    await sharp(path.join(SRC, file))
      .resize(w, w, { fit: 'cover' })
      .webp({ quality: w <= 320 ? 72 : 78 })
      .toFile(path.join(OUT, `${name}-${w}.webp`))
  }
  console.log(`✓ ${name}`)
}
