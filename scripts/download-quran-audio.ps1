$ErrorActionPreference = "Stop"

$baseUrl = "https://download.quranicaudio.com/quran/"
$targetRoot = Join-Path $PSScriptRoot "..\\public\\audio"

$sets = @(
  @{ Name = "abdul_basit_murattal"; Path = "abdul_basit_murattal/" },
  @{ Name = "mishaari_raashid_al_3afaasee"; Path = "mishaari_raashid_al_3afaasee/" },
  @{ Name = "abdulbasit_w_ibrahim_walk_si"; Path = "abdulbasit_w_ibrahim_walk_si/" },
  @{ Name = "mishaari_w_ibrahim_walk_si"; Path = "mishaari_w_ibrahim_walk_si/" }
)

if (-not (Test-Path $targetRoot)) {
  New-Item -ItemType Directory -Path $targetRoot | Out-Null
}

foreach ($set in $sets) {
  $folderName = $set.Path.TrimEnd("/")
  $targetDir = Join-Path $targetRoot $folderName
  if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir | Out-Null
  }

  Write-Host "Downloading set: $($set.Name)"
  for ($i = 1; $i -le 114; $i++) {
    $fileName = "{0:D3}.mp3" -f $i
    $destination = Join-Path $targetDir $fileName
    if (Test-Path $destination) {
      continue
    }
    $url = "$baseUrl$($set.Path)$fileName"
    curl.exe -L -s -o $destination $url
  }
}

Write-Host "Download complete."
