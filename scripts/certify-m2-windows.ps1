# Privileged acceptance checks run only on a disposable GitHub-hosted runner.
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') {
    throw 'Run this fixture on a disposable GitHub-hosted Windows runner.'
}
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Administrator privileges are required for the bounded VHD and firewall checks.'
}

$fixture = Join-Path $env:RUNNER_TEMP ('diskpond-m2-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $fixture | Out-Null
$image = Join-Path $fixture 'full.vhd'
$group = 'DiskPond acceptance ' + [guid]::NewGuid()
$attached = $false
$firewallProfiles = @()
function Invoke-Diskpart([string]$commands) {
    $script = Join-Path $fixture 'diskpart.txt'
    Set-Content -LiteralPath $script -Value $commands -Encoding ascii
    & diskpart /s $script
    if ($LASTEXITCODE -ne 0) { throw 'Fixture diskpart operation failed.' }
}
try {
    $letter = @('Z','Y','X','W','V','U') | Where-Object { -not (Test-Path "${_}:\") } | Select-Object -First 1
    if (-not $letter) { throw 'No free fixture drive letter.' }
    # Every diskpart operation selects only this newly created image.
    $attached = $true
    Invoke-Diskpart @"
create vdisk file="$image" maximum=96 type=fixed
select vdisk file="$image"
attach vdisk
create partition primary
format fs=ntfs quick label=DiskPondFixture
assign letter=$letter
"@
    $disk = Get-DiskImage -ImagePath $image | Get-Disk
    $partition = Get-Partition -DriveLetter $letter
    if ($partition.DiskNumber -ne $disk.Number -or $disk.IsBoot -or $disk.IsSystem) {
        throw 'Mounted volume is not the owned disposable image.'
    }
    $volume = Get-Volume -DriveLetter $letter
    if ($volume.FileSystemLabel -ne 'DiskPondFixture' -or $volume.Size -gt 128MB) {
        throw 'Unexpected fixture volume.'
    }
    $root = "${letter}:\"
    [IO.File]::WriteAllText((Join-Path $root 'diskpond-fixture.txt'), 'Disposable DiskPond full-volume fixture')
    $free = (Get-Volume -DriveLetter $letter).SizeRemaining
    & fsutil file createnew (Join-Path $root 'filler.bin') ($free - 1MB)
    if ($LASTEXITCODE -ne 0) { throw 'Could not reserve bounded fixture space.' }
    $env:DISKPOND_FULL_VOLUME = $root
    & pnpm smoke:restores
    if ($LASTEXITCODE -ne 0) { throw 'Full-volume restore checks failed.' }
    Remove-Item Env:DISKPOND_FULL_VOLUME

    $firewallProfiles = @(Get-NetFirewallProfile | Select-Object Name, Enabled)
    Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled True
    $electron = (& node -e "console.log(require('./apps/electron/node_modules/electron'))").Trim()
    $core = (Resolve-Path 'apps/core/dist/kopia_windows_amd64/kopia.exe').Path
    # Preserve loopback IPC; block IPv4/IPv6 outside loopback for both processes.
    $remote = @('0.0.0.0-126.255.255.255', '128.0.0.0-255.255.255.255', '::2-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')
    foreach ($program in @($electron, $core)) {
        New-NetFirewallRule -DisplayName ($group + ' ' + [IO.Path]::GetFileName($program)) -Group $group -Direction Outbound -Action Block -Program $program -RemoteAddress $remote -Profile Any | Out-Null
    }
    if (@(Get-NetFirewallRule -Group $group | Where-Object { $_.Enabled -eq 'True' -and $_.Action -eq 'Block' }).Count -ne 2) {
        throw 'Offline firewall rules were not installed.'
    }
    $env:DISKPOND_OFFLINE_CERTIFICATION = '1'
    & pnpm smoke:recovery
    if ($LASTEXITCODE -ne 0) { throw 'Offline desktop recovery failed.' }
    Write-Output 'M2 bounded full-volume and firewall-blocked desktop recovery passed.'
} finally {
    Remove-Item Env:DISKPOND_FULL_VOLUME -ErrorAction SilentlyContinue
    Remove-Item Env:DISKPOND_OFFLINE_CERTIFICATION -ErrorAction SilentlyContinue
    Get-NetFirewallRule -Group $group -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    foreach ($profile in $firewallProfiles) {
        Set-NetFirewallProfile -Profile $profile.Name -Enabled $profile.Enabled
    }
    if ($attached) {
        Invoke-Diskpart "select vdisk file=`"$image`"`ndetach vdisk"
    }
    Remove-Item -LiteralPath $fixture -Recurse -Force
}
