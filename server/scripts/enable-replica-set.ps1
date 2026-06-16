# Converts the local standalone MongoDB into a single-node replica set (rs0).
# This is what enables multi-document TRANSACTIONS, which the app now uses to make
# sales / purchases / returns / payments atomic (see server/utils/withTransaction.js).
#
# RUN THIS IN AN ELEVATED (Administrator) PowerShell:
#   powershell -ExecutionPolicy Bypass -File server\scripts\enable-replica-set.ps1
#
# It is idempotent and non-destructive to your data (a replica-set conversion keeps all data).
# After it finishes, set MONGODB_URI in server/.env to:
#   mongodb://localhost:27017/vyapar?replicaSet=rs0
# then restart the Node server. You should see: "MongoDB transactions: ENABLED".

$ErrorActionPreference = 'Stop'

# --- Require admin ---
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "This script must be run as Administrator (right-click PowerShell -> Run as administrator)."
    exit 1
}

# --- Locate config + service ---
$cfgPath = 'C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg'
$mongosh = 'C:\Users\asus\AppData\Local\Programs\mongosh\mongosh.exe'
$serviceName = (Get-Service -Name 'MongoDB*' | Select-Object -First 1).Name

if (-not (Test-Path $cfgPath)) { Write-Error "mongod.cfg not found at $cfgPath"; exit 1 }
if (-not $serviceName)        { Write-Error "MongoDB service not found"; exit 1 }

Write-Host "Config:  $cfgPath"
Write-Host "Service: $serviceName"

# --- Back up the config once ---
$backup = "$cfgPath.bak"
if (-not (Test-Path $backup)) { Copy-Item $cfgPath $backup; Write-Host "Backed up config to $backup" }

# --- Enable replication if not already enabled ---
$cfg = Get-Content $cfgPath -Raw
if ($cfg -match '(?m)^\s*replication:\s*$') {
    Write-Host "replication: block already present — leaving config as-is."
} else {
    # Replace the commented placeholder, or append if it's missing.
    if ($cfg -match '(?m)^#replication:\s*$') {
        $cfg = $cfg -replace '(?m)^#replication:\s*$', "replication:`r`n  replSetName: rs0"
    } else {
        $cfg = $cfg.TrimEnd() + "`r`n`r`nreplication:`r`n  replSetName: rs0`r`n"
    }
    Set-Content -Path $cfgPath -Value $cfg -Encoding ASCII
    Write-Host "Added 'replication: replSetName: rs0' to mongod.cfg"
}

# --- Restart the service to pick up the new config ---
Write-Host "Restarting $serviceName ..."
Restart-Service -Name $serviceName -Force
Start-Sleep -Seconds 4

# --- Initiate the replica set (advertise 'localhost' so the local URI keeps working) ---
$initJs = "try { rs.status(); print('ALREADY_INITIATED'); } catch (e) { rs.initiate({ _id: 'rs0', members: [ { _id: 0, host: 'localhost:27017' } ] }); print('INITIATED'); }"
& $mongosh --quiet --eval $initJs

Write-Host ""
Write-Host "Waiting for the node to become PRIMARY ..."
& $mongosh --quiet --eval "var ok=false; for (var i=0;i<30 && !ok;i++){ try{ if(db.hello().isWritablePrimary){ ok=true; } }catch(e){} sleep(1000); } print(ok ? 'PRIMARY_READY' : 'TIMED_OUT');"

Write-Host ""
Write-Host "DONE. Next steps:"
Write-Host "  1. Set MONGODB_URI in server/.env to: mongodb://localhost:27017/vyapar?replicaSet=rs0"
Write-Host "  2. Restart the Node server. Expect log line: 'MongoDB transactions: ENABLED'."
