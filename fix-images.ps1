# PowerShell script to regenerate signed URLs for Railbucket images
# This script will prompt you for credentials

Write-Host "🔄 Regenerating signed URLs for Railbucket images..." -ForegroundColor Cyan
Write-Host ""

# Get credentials from user
$accessKeyId = Read-Host "Enter Railbucket Access Key ID (from Railway → Appify-Railbucket → Credentials)"
$secretAccessKey = Read-Host "Enter Railbucket Secret Access Key (from Railway → Appify-Railbucket → Credentials)"

if ([string]::IsNullOrWhiteSpace($accessKeyId) -or [string]::IsNullOrWhiteSpace($secretAccessKey)) {
    Write-Host "❌ Credentials are required!" -ForegroundColor Red
    exit 1
}

# Set environment variables
$env:RAILBUCKET_ACCESS_KEY_ID = $accessKeyId
$env:RAILBUCKET_SECRET_ACCESS_KEY = $secretAccessKey
$env:DATABASE_URL = "postgresql://postgres:SutGuMkPQWYuWNudhUrpDWYWQgfUHYWZ@shortline.proxy.rlwy.net:53169/railway"

Write-Host ""
Write-Host "Running script..." -ForegroundColor Yellow
Write-Host ""

# Run the Node.js script
node regenerate-signed-urls-direct.js
