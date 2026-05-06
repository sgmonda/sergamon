/**
 * Recompute all sfnt table checksums and head.checkSumAdjustment in-place.
 *
 * opentype.js v1.3.4 generates a valid sfnt with correct checksums, but any
 * post-generation binary patch (see patchPostIsFixedPitch / patchHeadFontRevision
 * in build-font.ts) leaves the affected table's directory checksum and the
 * whole-file head.checkSumAdjustment stale. macOS / Linux / browsers ignore
 * stale checksums; the Windows Font Viewer rejects the file as "not a valid
 * font file" (issue #2).
 *
 * This is idempotent: running it on a font with already-correct checksums is a
 * no-op. Call it as the last step of any pipeline that mutates table contents.
 */
const HEAD_CHECKSUM_ADJUSTMENT_OFFSET = 8;
const MAGIC = 0xb1b0afba;

/**
 * Standard sfnt table checksum: sum-of-uint32BE over the table's bytes,
 * zero-padded up to a 4-byte boundary, taken mod 2^32.
 */
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

/**
 * Walk the table directory, recompute every table's checksum, and update
 * head.checkSumAdjustment so the whole-file checksum matches the spec.
 *
 * The spec defines head.checkSumAdjustment as 0xB1B0AFBA - sum_of_entire_file
 * with the field itself temporarily set to zero. Setting it to zero before
 * computing each table's checksum *and* the whole-file sum is required.
 */
export function recomputeChecksums(buf: Buffer): void {
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
    throw new Error("recomputeChecksums: head table not found");
  }

  // Zero head.checkSumAdjustment so it doesn't contaminate either the head
  // table's own checksum or the whole-file sum.
  buf.writeUInt32BE(0, headOffset + HEAD_CHECKSUM_ADJUSTMENT_OFFSET);

  for (let i = 0; i < numTables; i++) {
    const dir = 12 + i * 16;
    const offset = buf.readUInt32BE(dir + 8);
    const length = buf.readUInt32BE(dir + 12);
    const sum = tableChecksum(buf, offset, length);
    buf.writeUInt32BE(sum, dir + 4);
  }

  // Whole-file checksum: same algorithm applied to the entire buffer.
  const fileSum = tableChecksum(buf, 0, buf.length);
  const adjustment = (MAGIC - fileSum) >>> 0;
  buf.writeUInt32BE(adjustment, headOffset + HEAD_CHECKSUM_ADJUSTMENT_OFFSET);
}
