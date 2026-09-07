// Generates PNG app icons (192/512) without extra dependencies: a rounded blue square with a compass dial.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
function lerp(a, b, t) { return a + (b - a) * t; }
function draw(size) {
  const c = size / 2, R = size * 0.32, rad = size * 0.22;
  return png(size, (x, y) => {
    const dx = x - c, dy = y - c;
    // rounded square mask
    const ax = Math.abs(dx) - (c - rad), ay = Math.abs(dy) - (c - rad);
    const inside = ax <= 0 || ay <= 0 ? true : Math.hypot(ax, ay) <= rad;
    if (!inside) return [0, 0, 0, 0];
    const t = (x + y) / (2 * size);
    let r = lerp(31, 10, t), g = lerp(90, 15, t), b = lerp(240, 31, t);
    const d = Math.hypot(dx, dy - size * 0.01);
    if (d < R) { r = 255; g = 253; b = 248; }
    // needle
    const nx = dx, ny = dy - size * 0.01;
    const inNeedle = Math.abs(nx) < (R * 0.14) * (1 - Math.abs(ny) / (R * 0.85)) && Math.abs(ny) < R * 0.85;
    if (inNeedle) { if (ny < 0) { r = 31; g = 90; b = 240; } else { r = 255; g = 107; b = 107; } }
    if (d < size * 0.035) { r = 255; g = 253; b = 248; }
    return [Math.round(r), Math.round(g), Math.round(b), 255];
  });
}
mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", draw(192));
writeFileSync("public/icons/icon-512.png", draw(512));
console.log("icons written");
