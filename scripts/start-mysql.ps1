# Menjalankan MySQL portable (development) di 127.0.0.1:3306 lalu membuat database & user Finora.
$ErrorActionPreference = 'Stop'
$root  = Split-Path -Parent $PSScriptRoot
$tools = Join-Path $root '.tools'
$bin   = Join-Path $tools 'mysql\bin'

$running = Get-Process mysqld -ErrorAction SilentlyContinue
if (-not $running) {
  Start-Process -FilePath (Join-Path $bin 'mysqld.exe') -ArgumentList "--defaults-file=`"$(Join-Path $tools 'my.ini')`"" -WindowStyle Hidden
  Write-Host 'Menunggu MySQL siap...'
  $ErrorActionPreference = 'Continue'
  for ($i = 0; $i -lt 60; $i++) {
    & (Join-Path $bin 'mysqladmin.exe') -u root --host=127.0.0.1 ping 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep 1
  }
  $ErrorActionPreference = 'Stop'
}

$sql = @"
CREATE DATABASE IF NOT EXISTS finora CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS finora_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'finora'@'127.0.0.1' IDENTIFIED BY 'finora_dev_password';
CREATE USER IF NOT EXISTS 'finora'@'localhost' IDENTIFIED BY 'finora_dev_password';
GRANT ALL PRIVILEGES ON finora.* TO 'finora'@'127.0.0.1', 'finora'@'localhost';
GRANT ALL PRIVILEGES ON finora_test.* TO 'finora'@'127.0.0.1', 'finora'@'localhost';
FLUSH PRIVILEGES;
"@
$sql | & (Join-Path $bin 'mysql.exe') -u root --host=127.0.0.1
Write-Host 'MySQL siap: database finora & finora_test, user finora (development only).'
