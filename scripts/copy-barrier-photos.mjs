/**
 * barrier_free_photos_* → public/images/barrier/
 * Next.js는 public/ 아래 파일만 정적 제공하므로 빌드 전에 복사합니다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const PHOTO_DIR_NAMES = [
  "barrier_free_photos_1778423209775",
  "barrier_free_photos",
];

function findPhotoSourceDir() {
  if (process.env.BARRIER_FREE_PHOTOS_DIR) {
    const custom = path.resolve(process.env.BARRIER_FREE_PHOTOS_DIR);
    if (fs.existsSync(custom)) return custom;
  }
  for (const name of PHOTO_DIR_NAMES) {
    const dir = path.join(projectRoot, name);
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) return dir;
  }
  return null;
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDirRecursive(from, to);
    } else if (/\.(jpe?g|png|webp|gif)$/i.test(entry.name)) {
      fs.copyFileSync(from, to);
      count++;
    }
  }
  return count;
}

const srcDir = findPhotoSourceDir();
const destDir = path.join(projectRoot, "public", "images", "barrier");

if (!srcDir) {
  console.warn(
    "Barrier photos: source folder not found (barrier_free_photos_1778423209775). Skipping copy.",
  );
  process.exit(0);
}

if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
}

const copied = copyDirRecursive(srcDir, destDir);
console.log(`Barrier photos: copied ${copied} images from ${path.basename(srcDir)} → public/images/barrier/`);
