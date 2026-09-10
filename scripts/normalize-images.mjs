/**
 * src/assets 아래 이미지를 일정한 크기의 webp로 통일한다.
 *
 *   node scripts/normalize-images.mjs
 *
 * 새 영웅·펫·건물 이미지를 받아온 뒤 한 번 돌리면 된다.
 * 이미 규격에 맞는 파일은 건너뛴다.
 */
import sharp from 'sharp';
import { readdir, unlink, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets');
const SIZES = { heroes: 256, pets: 256, buildings: 256, ui: 64 };
const EXTS = ['.png', '.jpg', '.jpeg', '.webp'];

for (const [dir, size] of Object.entries(SIZES)) {
  const d = path.join(ROOT, dir);
  let files;
  try {
    files = await readdir(d);
  } catch {
    continue;
  }

  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    if (!EXTS.includes(ext)) continue;

    const full = path.join(d, f);
    // 원본을 버퍼로 먼저 읽는다. 경로를 그대로 넘기면 sharp가 파일을 잡고 있어
    // 같은 파일을 지우려 할 때 Windows에서 EBUSY가 난다.
    const input = await readFile(full);
    const meta = await sharp(input).metadata();
    if (ext === '.webp' && meta.width === size && meta.height === size) continue;

    const base = path.basename(f, ext);
    const target = path.join(d, `${base}.webp`);
    const before = (await stat(full)).size;

    const output = await sharp(input)
      .resize(size, size, { fit: 'cover', position: 'top' })
      .webp({ quality: 82 })
      .toBuffer();

    if (ext !== '.webp') await unlink(full);
    await writeFile(target, output);

    const after = (await stat(target)).size;
    console.log(
      `${dir}/${base}`.padEnd(34),
      `${meta.width}x${meta.height} ${ext.slice(1)} ${(before / 1024).toFixed(0)}KB`.padEnd(26),
      `-> ${size}px webp ${(after / 1024).toFixed(0)}KB`
    );
  }
}

console.log('\ndone');
