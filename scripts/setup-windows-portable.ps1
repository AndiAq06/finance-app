# Finora — setup runtime portable untuk Windows (tanpa admin, tanpa Docker).
# Mengunduh PHP 8.4 (NTS x64), Composer, dan MySQL 8.4 LTS (zip resmi) ke folder .tools/
# Pemakaian:  powershell -ExecutionPolicy Bypass -File scripts\setup-windows-portable.ps1
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root  = Split-Path -Parent $PSScriptRoot
$tools = Join-Path $root '.tools'
New-Item -ItemType Directory -Force -Path $tools | Out-Null

$phpVersion   = '8.4.26'
$phpZip       = "php-$phpVersion-nts-Win32-vs17-x64.zip"
$phpSha256    = 'da68394f9193b7f6b89d0c76861a4034ae10efee7fd55a7255d8118c2acf70d7'
$mysqlVersion = '8.4.11'

function Get-File($url, $dest) {
  if (Test-Path $dest) { Write-Host "  sudah ada: $dest"; return }
  Write-Host "  mengunduh $url"
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile "$dest.part"
  Move-Item "$dest.part" $dest
}

# ---------------- PHP
$phpDir = Join-Path $tools 'php'
if (-not (Test-Path (Join-Path $phpDir 'php.exe'))) {
  Write-Host '[1/3] PHP'
  $zip = Join-Path $tools $phpZip
  Get-File "https://windows.php.net/downloads/releases/$phpZip" $zip
  $hash = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
  if ($hash -ne $phpSha256) {
    # Rilis lama dipindah ke /archives; checksum dicek agar file tidak rusak/termodifikasi.
    throw "Checksum PHP tidak cocok ($hash)"
  }
  Expand-Archive $zip -DestinationPath $phpDir -Force
}
$ini = Join-Path $phpDir 'php.ini'
if (-not (Test-Path $ini)) {
  Copy-Item (Join-Path $phpDir 'php.ini-development') $ini
  $c = Get-Content $ini -Raw
  foreach ($ext in 'pdo_mysql','mysqli','mbstring','openssl','fileinfo','curl','zip','intl','bcmath','sodium') {
    $c = $c -replace ";extension=$ext\b", "extension=$ext"
  }
  $c = $c -replace ';extension_dir = "ext"', 'extension_dir = "ext"'
  $c = $c -replace ';date.timezone =', 'date.timezone = UTC'
  $c = $c -replace 'memory_limit = 128M', 'memory_limit = 512M'
  $c = $c -replace 'upload_max_filesize = 2M', 'upload_max_filesize = 8M'
  Set-Content $ini $c -Encoding ascii
}

# ---------------- Composer
Write-Host '[2/3] Composer'
Get-File 'https://getcomposer.org/download/latest-stable/composer.phar' (Join-Path $tools 'composer.phar')
Set-Content (Join-Path $tools 'composer.bat') "@`"%~dp0php\php.exe`" `"%~dp0composer.phar`" %*" -Encoding ascii

# ---------------- MySQL
$mysqlDir = Join-Path $tools 'mysql'
if (-not (Test-Path (Join-Path $mysqlDir 'bin\mysqld.exe'))) {
  Write-Host '[3/3] MySQL'
  $zip = Join-Path $tools "mysql-$mysqlVersion-winx64.zip"
  Get-File "https://cdn.mysql.com/Downloads/MySQL-8.4/mysql-$mysqlVersion-winx64.zip" $zip
  Expand-Archive $zip -DestinationPath $tools -Force
  Rename-Item (Join-Path $tools "mysql-$mysqlVersion-winx64") $mysqlDir
}
$data = Join-Path $tools 'mysql-data'
if (-not (Test-Path $data)) {
  Write-Host '  inisialisasi data directory MySQL (root tanpa password, hanya localhost untuk development)'
  & (Join-Path $mysqlDir 'bin\mysqld.exe') --initialize-insecure --basedir="$mysqlDir" --datadir="$data" --console
}
$myIni = Join-Path $tools 'my.ini'
Set-Content $myIni @"
[mysqld]
basedir=$($mysqlDir -replace '\\','/')
datadir=$($data -replace '\\','/')
port=3306
bind-address=127.0.0.1
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
default-time-zone='+00:00'
"@ -Encoding ascii

Write-Host ''
Write-Host 'Selesai. Jalankan MySQL dengan:  powershell -File scripts\start-mysql.ps1'
