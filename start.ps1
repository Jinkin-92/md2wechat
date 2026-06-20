# md2wechat start helper (PowerShell)
# 1. 杀掉所有 md2wechat 相关的 node 进程
# 2. 启动 dev (concurrently 跑 server + client),后台
# 3. 探活 3410 / 5373 (最多 60s)
# 4. 打开浏览器
# 5. 保留窗口 pause,让用户看到状态

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$projectDir  = "D:\code\中绿康桥公众号\md2wechat"
$logFile     = Join-Path $projectDir "start-dev.log"
$backendUrl  = "http://localhost:3410/api/health"
$frontendUrl = "http://localhost:5373"
$workbenchUrl = "http://localhost:5373/workbench"

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host " md2wechat 启动脚本" -ForegroundColor Cyan
Write-Host " 时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# ---- 1. 清理旧进程 ----
Write-Host "[1/4] 清理旧 node 进程 ..." -ForegroundColor Yellow
$killed = 0
Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object {
  $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine
  if ($cmd -and $cmd -match "md2wechat") {
    Write-Host "  kill PID $($_.Id)  ($($_.StartTime.ToString('HH:mm:ss')))" -ForegroundColor DarkYellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    $killed++
  }
}
if ($killed -eq 0) {
  Write-Host "  (没有需要清理的进程)" -ForegroundColor DarkGray
} else {
  Write-Host "  已清理 $killed 个 node 进程" -ForegroundColor Green
}
Write-Host ""
Start-Sleep -Seconds 2

# ---- 2. 启动 dev (后台,日志到 start-dev.log) ----
Write-Host "[2/4] 启动 dev server (后台) ..." -ForegroundColor Yellow
Set-Location $projectDir
# 用 cmd /k 让 dev server 一直跑(不会 /c 后立即 exit)
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/k","npm run dev > `"$logFile`" 2>&1" -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru
if ($null -eq $proc) {
  Write-Host "  [错误] Start-Process 启动失败" -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}
Write-Host "  dev shell PID: $($proc.Id)  日志: $logFile" -ForegroundColor DarkGray
Write-Host "  等待前后端就绪..." -ForegroundColor DarkGray
Write-Host ""

# ---- 3. 探活 3410 / 5373 ----
Write-Host "[3/4] 等待端口就绪 (最多 90 秒) ..." -ForegroundColor Yellow
$ready = $false
$wait = 0
while ($wait -lt 90) {
  Start-Sleep -Seconds 2
  $wait += 2
  $backendOk  = $false
  $frontendOk = $false
  try {
    $h = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $backendUrl -ErrorAction Stop
    if ($h.StatusCode -eq 200) { $backendOk = $true }
  } catch { $backendOk = $false }
  try {
    $h = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $frontendUrl -ErrorAction Stop
    if ($h.StatusCode -eq 200) { $frontendOk = $true }
  } catch { $frontendOk = $false }

  $bMark = if ($backendOk)  { "[OK]" } else { "[..]" }
  $fMark = if ($frontendOk) { "[OK]" } else { "[..]" }
  Write-Host ("  [{0}s]  后端 {1}  前端 {2}" -f $wait, $bMark, $fMark)

  if ($backendOk -and $frontendOk) {
    $ready = $true
    break
  }
}
Write-Host ""

if (-not $ready) {
  # 检查 dev shell 是否还活着
  $stillAlive = $false
  try {
    $p = Get-Process -Id $proc.Id -ErrorAction Stop
    if (-not $p.HasExited) { $stillAlive = $true }
  } catch {}

  Write-Host "  [失败] 90 秒内端口未就绪" -ForegroundColor Red
  if (-not $stillAlive) {
    Write-Host "  原因: dev shell PID $($proc.Id) 已经退出" -ForegroundColor Red
  }
  Write-Host "  排查: 打开 $logFile 看 npm 错误" -ForegroundColor Red
  Write-Host ""
  Read-Host "Press Enter to exit"
  exit 1
}

Write-Host "  后端 $backendUrl  OK" -ForegroundColor Green
Write-Host "  前端 $frontendUrl  OK" -ForegroundColor Green
Write-Host ""

# ---- 4. 打开浏览器 ----
Write-Host "[4/4] 打开浏览器 ..." -ForegroundColor Yellow
try {
  Start-Process $workbenchUrl
  Write-Host "  已启动默认浏览器 → $workbenchUrl" -ForegroundColor Green
} catch {
  Write-Host "  浏览器启动失败,请手动打开: $workbenchUrl" -ForegroundColor Red
}
Write-Host ""

Write-Host "===========================================================" -ForegroundColor Green
Write-Host " md2wechat 已就绪" -ForegroundColor Green
Write-Host "  - 后端:  $backendUrl" -ForegroundColor Green
Write-Host "  - 前端:  $frontendUrl" -ForegroundColor Green
Write-Host "  - 工作台: $workbenchUrl" -ForegroundColor Green
Write-Host "  - 日志:  $logFile" -ForegroundColor Green
Write-Host " 关闭此窗口不会停服务(后台 cmd 进程在跑)" -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Green

Read-Host "Press Enter to close (server keeps running in background)"
