/**
 * 시설 아이콘 PNG → public/icons/facilities/
 * - public/해당 아이콘 파일/ (또는 프로젝트 루트 해당 아이콘 파일/)에
 *   toilet.png, ramp.png, elevator.png, parking.png 가 있으면 그대로 복사
 * - 없으면 해당 폴더의 .png 를 이름순으로 4개 → toilet, ramp, elevator, parking 순
 * - 그것도 없으면 Cursor workspaceStorage assets (개발 PC)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const destDir = path.join(projectRoot, "public", "icons", "facilities");
const names = ["toilet.png", "ramp.png", "elevator.png", "parking.png"];

const userDirs = [
  path.join(projectRoot, "public", "해당 아이콘 파일"),
  path.join(projectRoot, "해당 아이콘 파일"),
];

const assetsFallback = path.join(
  process.env.USERPROFILE ?? "",
  ".cursor",
  "projects",
  "c-Users-seongmin-Desktop",
  "assets",
);
const assetFiles = [
  "c__Users_seongmin_AppData_Roaming_Cursor_User_workspaceStorage_7ffb16788f3b95961d270e390a744f6a_images____-8717ee3a-eb05-4c70-a6a8-4786e3bf21eb.png",
  "c__Users_seongmin_AppData_Roaming_Cursor_User_workspaceStorage_7ffb16788f3b95961d270e390a744f6a_images_ramp_5273280-e7957284-8198-46d3-b526-9f0a38250cbe.png",
  "c__Users_seongmin_AppData_Roaming_Cursor_User_workspaceStorage_7ffb16788f3b95961d270e390a744f6a_images_elevator_7431108-8a6d9b91-eb6d-4098-a0ca-44dfa71f862f.png",
  "c__Users_seongmin_AppData_Roaming_Cursor_User_workspaceStorage_7ffb16788f3b95961d270e390a744f6a_images_parking-sign_9434722-9f9ccb38-985c-4f6c-8a6c-393a09d05db6.png",
];

function firstExistingUserDir() {
  for (const d of userDirs) {
    if (fs.existsSync(d) && fs.statSync(d).isDirectory()) return d;
  }
  return null;
}

function listPng(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => /\.png$/i.test(f))
    .sort((a, b) => a.localeCompare(b, "ko"))
    .map((f) => path.join(dir, f));
}

fs.mkdirSync(destDir, { recursive: true });

let done = 0;
const userDir = firstExistingUserDir();

if (userDir) {
  const allExact = names.every((n) => fs.existsSync(path.join(userDir, n)));
  if (allExact) {
    for (const name of names) {
      fs.copyFileSync(path.join(userDir, name), path.join(destDir, name));
    }
    done = 4;
    console.log(`Facility icons: copied named PNGs from ${userDir}`);
  } else {
    const pngs = listPng(userDir);
    if (pngs.length >= 4) {
      for (let i = 0; i < 4; i++) {
        fs.copyFileSync(pngs[i], path.join(destDir, names[i]));
      }
      done = 4;
      console.log(
        `Facility icons: mapped first 4 PNGs (sorted) from ${userDir} → ${names.join(", ")} (정확히 쓰려면 toilet/ramp/elevator/parking.png 로 저장)`,
      );
    }
  }
}

if (done < 4 && fs.existsSync(assetsFallback)) {
  let ok = true;
  for (let i = 0; i < 4; i++) {
    const from = path.join(assetsFallback, assetFiles[i]);
    if (!fs.existsSync(from)) {
      ok = false;
      break;
    }
    fs.copyFileSync(from, path.join(destDir, names[i]));
  }
  if (ok) {
    done = 4;
    console.log(`Facility icons: copied from Cursor assets → ${destDir}`);
  }
}

if (done < 4) {
  console.warn(
    `Facility icons: ${done}/4 복사됨. public/해당 아이콘 파일/에 PNG 4개 또는 toilet.png,ramp.png,elevator.png,parking.png 를 넣고 npm run copy:facility-icons 실행.`,
  );
}
