# ChatZ Update Publisher Script
# Usage: .\scripts\publish-update.ps1 -DownloadUrl "https://..." -Title "New Features" -Description "Details"

param(
    [string]$DownloadUrl,
    [string]$Title = "New Features Available",
    [string]$Description = "Update available with improvements and fixes",
    [int]$VersionCode = 2,
    [string]$VersionName = "1.1",
    [bool]$Mandatory = $false
)

# Calculate SHA-256 of release APK
$apkPath = "android\app\build\outputs\apk\release\app-release.apk"
$hash = (Get-FileHash $apkPath -Algorithm SHA256).Hash.ToLower()

Write-Host "=== ChatZ Update Publisher ==="
Write-Host "Version: $VersionName ($VersionCode)"
Write-Host "SHA-256: $hash"
Write-Host "Download URL: $DownloadUrl"
Write-Host ""

if (-not $DownloadUrl) {
    Write-Host "ERROR: Please provide -DownloadUrl parameter"
    Write-Host "Example: .\scripts\publish-update.ps1 -DownloadUrl 'https://github.com/.../app-release.apk'"
    exit 1
}

# Firestore document structure
$firestoreDoc = @"
{
  "latestVersionCode": $VersionCode,
  "latestVersionName": "$VersionName",
  "downloadUrl": "$DownloadUrl",
  "sha256": "$hash",
  "title": "$Title",
  "description": "$Description",
  "changes": [],
  "mandatory": $Mandatory,
  "releaseDate": "$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')"
}
"@

Write-Host "=== Firestore Document (copy to Firebase Console) ==="
Write-Host "Collection: appConfig"
Write-Host "Document ID: updateMetadata"
Write-Host ""
Write-Host "Fields:"
Write-Host "  latestVersionCode: $VersionCode (number)"
Write-Host "  latestVersionName: '$VersionName' (string)"
Write-Host "  downloadUrl: '$DownloadUrl' (string)"
Write-Host "  sha256: '$hash' (string)"
Write-Host "  title: '$Title' (string)"
Write-Host "  description: '$Description' (string)"
Write-Host "  mandatory: $Mandatory (boolean)"
Write-Host "  releaseDate: timestamp or string"
Write-Host ""
Write-Host "Paste this JSON in Firebase Console → Firestore → appConfig → updateMetadata:"
Write-Host $firestoreDoc
Write-Host ""
Write-Host "After publishing, connected devices will show update popup within 5-10 seconds."
