/**
 * 흰색 둥근 테두리가 박혀 있는 이미지에서 테두리만 잘라낸다.
 *
 *   node scripts/crop-frames.mjs
 *
 * ⚠️ 반드시 1회만 실행할 것. 반복하면 실행할 때마다 더 잘려나가서
 *    얼굴이 날아간다. 이미 정리된 파일에는 다시 돌리지 말 것.
 *    (다시 돌려야 하면 원본을 받아온 뒤에 실행한다.)
 *
 * 출처가 둘이라 일부 파일에만 흰 테두리가 있다. 아래 목록에 적힌 파일만
 * 각 변에서 CROP_RATIO 만큼 잘라내고 원래 크기(256px)로 되돌린다.
 * 건물(buildings)과 UI 아이콘(ui)은 테두리가 없으므로 건드리지 않는다.
 */
import sharp from 'sharp';
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets');

/** 각 변에서 잘라낼 비율 */
const CROP_RATIO = 0.07;

const TARGETS = {
  heroes: [
    'alcar', 'amadeus', 'eric', 'helga', 'hilde', 'jabel', 'jaeger', 'long-fei',
    'margot', 'marlin', 'petra', 'rosa', 'saul', 'sophia', 'thrud', 'triton',
    'vivian', 'yang', 'zoe',
  ],
  pets: [
    'alpha-black-panther', 'bison', 'cheetah', 'giant-rhino', 'gray-wolf',
    'great-moose', 'grizzly-bear', 'ironclad-war-elephant', 'lion', 'lynx',
    'mighty-bison', 'moose', 'regal-white-lion',
  ],
};

let count = 0;

for (const [dir, slugs] of Object.entries(TARGETS)) {
  for (const slug of slugs) {
    const full = path.join(ROOT, dir, `${slug}.webp`);

    // 경로를 sharp에 직접 넘기면 파일 핸들을 잡고 있어 같은 경로로 다시 쓸 때
    // Windows에서 EBUSY가 난다. 반드시 버퍼로 읽어서 넘긴다.
    const input = await readFile(full);
    const meta = await sharp(input).metadata();
    const { width, height } = meta;

    const dx = Math.round(width * CROP_RATIO);
    const dy = Math.round(height * CROP_RATIO);

    const output = await sharp(input)
      .extract({ left: dx, top: dy, width: width - dx * 2, height: height - dy * 2 })
      .resize(width, height, { fit: 'fill' })
      .webp({ quality: 82 })
      .toBuffer();

    await writeFile(full, output);
    count += 1;

    const after = (await stat(full)).size;
    console.log(
      `${dir}/${slug}`.padEnd(32),
      `${width}x${height} -> crop ${dx}px -> ${width}x${height}`,
      `${(after / 1024).toFixed(0)}KB`,
    );
  }
}

console.log(`\ndone — ${count} files cropped`);
