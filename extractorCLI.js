#!/usr/bin/env node
/**
 * extractorCLI.js
 * Usage: node extractorCLI.js centralbank.pak <input>.pak
 * Output: /output/<input>/*
 */

import { readFile, mkdir, writeFile } from 'fs/promises';
import { join, dirname, basename, extname } from 'path';

// Helper: read a 4-byte uint32 (little-endian)
function readUInt32LE(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

// Main decode function
async function decodePak(buffer, outDir) {
  let offset = 0;
  const decoder = new TextDecoder();

  const totalFiles = readUInt32LE(buffer, offset);
  offset += 4;

  // Read all paths
  const paths = [];
  for (let i = 0; i < totalFiles; i++) {
    const nameLen = readUInt32LE(buffer, offset);
    offset += 4;
    const nameBuf = buffer.subarray(offset, offset + nameLen);
    offset += nameLen;
    paths.push(decoder.decode(nameBuf));
  }

  // Extract each file
  for (const relPath of paths) {
    const fileLen = readUInt32LE(buffer, offset);
    offset += 4;
    const fileBuf = buffer.subarray(offset, offset + fileLen);
    offset += fileLen;

    const target = join(outDir, relPath);
    console.log('Creating file:', target)
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, fileBuf);
  }

  console.log(`Extracted ${paths.length} files to ${outDir}`);
}

async function main() {
  const [,, input] = process.argv;
  if (!input || extname(input).toLowerCase() !== '.pak') {
    console.error('Usage: extractorCLI.js <file>.pak');
    process.exit(1);
  }

  const base = basename(input, '.pak');
  const outDir = join('output', base);

  try {
    const data = await readFile(input);
    await decodePak(data, outDir);
  } catch (err) {
    console.error('Error:', err);
    process.exit(2);
  }
}

main();
