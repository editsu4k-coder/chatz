# ChatZ GitHub Release Creator
# This script creates a GitHub repository and uploads the release APK

$ErrorActionPreference = "Stop"

Write-Host "=== ChatZ GitHub Release Creator ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$repoName = "chatz"
$apkPath = "android/app/build/outputs/apk/release/app-release.apk"
$versionTag = "v1.1"
$releaseTitle = "ChatZ v1.1 - Professional Update System"
$releaseBody = @"
## What's New

- Friend card hide/show toggle with localStorage persistence
- Sort friends by screen time (highest first)
- DM list sorted by online status
- Fix online indicator accuracy (actual presence check)
- Circular ring refresh animation (consistent across app)
- Real-time Firestore update listener for automatic notifications
- Release signing configuration with production keystore
- SHA-256 APK verification for secure updates
- Professional in-app update workflow (no manual APK sharing)

## Installation

Download the APK and install on your Android device.
"@

# Check if APK exists
if (-not (Test-Path $apkPath)) {
    Write-Host "ERROR: APK not found at $apkPath" -ForegroundColor Red
    Write-Host "Please build the release APK first:" -ForegroundColor Yellow
    Write-Host "  cd android && ./gradlew assembleRelease" -ForegroundColor Yellow
    exit 1
}

# Get GitHub username from git config or prompt
$githubUsername = git config user.name 2>$null
if (-not $githubUsername) {
    $githubUsername = Read-Host "Enter your GitHub username"
}

Write-Host "Creating repository '$repoName' for user '$githubUsername'..." -ForegroundColor Green

# Try to create repo using gh CLI
try {
    $ghExists = Get-Command gh -ErrorAction Stop
    Write-Host "GitHub CLI found, creating repository..." -ForegroundColor Green

    gh repo create "$githubUsername/$repoName" --public --source=. --push 2>$null

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Repository created successfully!" -ForegroundColor Green
        $repoUrl = "https://github.com/$githubUsername/$repoName"
    } else {
        throw "gh repo create failed"
    }
} catch {
    # Fallback: use git remote + web URL
    Write-Host "GitHub CLI not available." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please do the following manually:" -ForegroundColor Cyan
    Write-Host "1. Go to: https://github.com/new" -ForegroundColor White
    Write-Host "2. Create repository named: $repoName" -ForegroundColor White
    Write-Host "3. Run these commands:" -ForegroundColor White
    Write-Host ""
    Write-Host "   git remote add origin https://github.com/$githubUsername/$repoName.git" -ForegroundColor Yellow
    Write-Host "   git branch -M main" -ForegroundColor Yellow
    Write-Host "   git push -u origin main" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "After pushing, go to Releases and create a new release with tag $versionTag" -ForegroundColor Cyan
    Write-Host "Upload this file: $apkPath" -ForegroundColor Cyan
    exit 0
}

# Create release
Write-Host "Creating release $versionTag..." -ForegroundColor Green
gh release create $versionTag $apkPath --title $releaseTitle --notes $releaseBody

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host "Release created at: https://github.com/$githubUsername/$repoName/releases/tag/$versionTag" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next step: Copy the APK download URL and publish to Firestore" -ForegroundColor Cyan
} else {
    Write-Host "Release creation failed. Please create manually at:" -ForegroundColor Red
    Write-Host "https://github.com/$githubUsername/$repoName/releases/new" -ForegroundColor Yellow
}
