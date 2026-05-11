# 최초 1회: GitHub(seongmin0402/barrier_free_map)에 코드 올리기
# PowerShell에서 실행:  .\scripts\first-push.ps1
# (실행 정책 오류 시) Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$remoteUrl = "https://github.com/seongmin0402/barrier_free_map.git"

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

# origin 없을 때 get-url 은 stderr 를 내고 PowerShell 이 오류로 처리함 → remote 목록으로 판별
$remoteNames = @(git remote 2>$null)
if ($remoteNames -contains "origin") {
  git remote set-url origin $remoteUrl
} else {
  git remote add origin $remoteUrl
}

Write-Host "원격: $remoteUrl"
git push -u origin main
