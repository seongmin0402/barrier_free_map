# 최초 1회: GitHub(seongmin04202/barrier_free_map)에 코드 올리기
# PowerShell에서 실행:  .\scripts\first-push.ps1
# (실행 정책 오류 시) Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$remoteUrl = "https://github.com/seongmin04202/barrier_free_map.git"

if (-not (Test-Path ".git")) {
  git init
  git branch -M main
}

git add -A
$status = git status --porcelain
if ([string]::IsNullOrEmpty($status)) {
  Write-Host "커밋할 변경 없음 — 이미 최신이거나 추적할 파일이 없습니다."
} else {
  git commit -m "chore: barrier-free map initial upload"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (git remote get-url origin 2>$null) {
  git remote set-url origin $remoteUrl
} else {
  git remote add origin $remoteUrl
}

Write-Host "원격: $remoteUrl"
git push -u origin main
