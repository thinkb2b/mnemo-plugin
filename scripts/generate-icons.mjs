import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const ICON_SIZES = [16, 32, 64, 80, 128];
const OUTPUT_DIR = 'public';
const COLOR = [37, 99, 235, 255]; // blue-600

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const chunkType = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([chunkType, data])), 0);

  return Buffer.concat([length, chunkType, data, crc]);
}

function createPng(size, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const [r, g, b, a] = rgba;
  const row = Buffer.alloc(size * 4);
  for (let i = 0; i < size; i++) {
    row[i * 4] = r;
    row[i * 4 + 1] = g;
    row[i * 4 + 2] = b;
    row[i * 4 + 3] = a;
  }

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const offset = y * (size * 4 + 1);
    raw[offset] = 0; // filter type
    row.copy(raw, offset + 1);
  }

  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', idat),
    createChunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
for (const size of ICON_SIZES) {
  const png = createPng(size, COLOR);
  writeFileSync(join(OUTPUT_DIR, `icon-${size}.png`), png);
}

console.log(`Generated icons: ${ICON_SIZES.join(', ')}`);
