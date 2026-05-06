/**
 * Verify that every table checksum in an sfnt file (TTF/OTF) matches what the
 * spec requires, and that head.checkSumAdjustment equals 0xB1B0AFBA minus the
 * whole-file checksum.
 *
 * Exits 0 on success, 1 on any mismatch — wired into npm run build:font as a
 * gate so a regression in the build pipeline (e.g. a binary patch without a
 * corresponding recompute) fails the build instead of shipping a font that
 * Windows refuses to install.
 *
 * Usage:  tsx scripts/verify-checksums.ts <path-to-font> [more paths...]
 */

import fs from "node:fs";
import path from "node:path";

const HEAD_CHECKSUM_ADJUSTMENT_OFFSET = 8;
const MAGIC = 0xb1b0afba;

function tableChecksum(buf: Buffer, offset: number, length: number): number {
  let sum = 0;
  const end = offset + length;
  let i = offset;
  while (i + 4 <= end) {
    sum = (sum + buf.readUInt32BE(i)) >>> 0;
    i += 4;
  }
  const remaining = end - i;
  if (remaining > 0) {
    let last = 0;
    for (let k = 0; k < remaining; k++) {
      last = (last << 8) | buf[i + k];
    }
    last <<= (4 - remaining) * 8;
    sum = (sum + (last >>> 0)) >>> 0;
  }
  return sum >>> 0;
}

function verify(filePath: string): boolean {
  const buf = fs.readFileSync(filePath);
  const numTables = buf.readUInt16BE(4);

  let headOffset = -1;
  for (let i = 0; i < numTables; i++) {
    const dir = 12 + i * 16;
    if (buf.toString("ascii", dir, dir + 4) === "head") {
      headOffset = buf.readUInt32BE(dir + 8);
      break;
    }
  }
  if (headOffset === -1) {
    console.error(`✗ ${filePath}: head table not found`);
    return false;
  }

  const storedAdjustment = buf.readUInt32BE(
    headOffset + HEAD_CHECKSUM_ADJUSTMENT_OFFSET,
  );

  // Spec: zero head.checkSumAdjustment before computing checksums.
  const work = Buffer.from(buf);
  work.writeUInt32BE(0, headOffset + HEAD_CHECKSUM_ADJUSTMENT_OFFSET);

  const errors: string[] = [];
  for (let i = 0; i < numTables; i++) {
    const dir = 12 + i * 16;
    const tag = work.toString("ascii", dir, dir + 4);
    const stored = work.readUInt32BE(dir + 4);
    const offset = work.readUInt32BE(dir + 8);
    const length = work.readUInt32BE(dir + 12);
    const actual = tableChecksum(work, offset, length);
    if (stored !== actual) {
      errors.push(
        `${tag} checksum: stored=0x${stored.toString(16).padStart(8, "0")} actual=0x${actual.toString(16).padStart(8, "0")}`,
      );
    }
  }

  const fileSum = tableChecksum(work, 0, work.length);
  const expectedAdjustment = (MAGIC - fileSum) >>> 0;
  if (expectedAdjustment !== storedAdjustment) {
    errors.push(
      `head.checkSumAdjustment: stored=0x${storedAdjustment.toString(16).padStart(8, "0")} expected=0x${expectedAdjustment.toString(16).padStart(8, "0")}`,
    );
  }

  const name = path.basename(filePath);
  if (errors.length === 0) {
    console.log(`✓ ${name}: ${numTables} tables, all checksums valid`);
    return true;
  }
  console.error(`✗ ${name}: ${errors.length} error(s)`);
  for (const e of errors) console.error(`    ${e}`);
  return false;
}

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error("usage: tsx scripts/verify-checksums.ts <font> [<font>...]");
  process.exit(2);
}

const allOk = paths.map(verify).every((ok) => ok);
process.exit(allOk ? 0 : 1);
