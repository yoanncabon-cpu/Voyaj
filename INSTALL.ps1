# VOYAJ — Script d'installation de l'environnement de développement
# Lance ce script UNE SEULE FOIS depuis PowerShell en tant qu'administrateur.
# Il installe Flutter, JDK 17, Firebase CLI, GitHub CLI et configure les variables d'environnement.

Write-Host "=== VOYAJ : Installation de l'environnement ===" -ForegroundColor Cyan

# 1. JDK 17 via scoop
Write-Host "`n[1/6] JDK 17 (Temurin)..." -ForegroundColor Yellow
scoop bucket add java 2>$null
scoop install temurin17-jdk

# 2. Flutter SDK via scoop
Write-Host "`n[2/6] Flutter SDK..." -ForegroundColor Yellow
scoop bucket add extras 2>$null
scoop install flutter

# 3. Variables d'environnement
Write-Host "`n[3/6] Variables d'environnement..." -ForegroundColor Yellow
$sdkPath = "$env:LOCALAPPDATA\Android\Sdk"
$javaHome = scoop prefix temurin17-jdk 2>$null
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $sdkPath, "User")
[System.Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", $sdkPath, "User")
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", $javaHome, "User")
$currentPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
$additions = @(
  "$sdkPath\platform-tools",
  "$sdkPath\emulator",
  "$sdkPath\cmdline-tools\latest\bin"
)
foreach ($a in $additions) {
  if ($currentPath -notlike "*$a*") { $currentPath += ";$a" }
}
[System.Environment]::SetEnvironmentVariable("PATH", $currentPath, "User")
Write-Host "  ANDROID_HOME = $sdkPath"
Write-Host "  JAVA_HOME    = $javaHome"

# 4. Firebase CLI via npm
Write-Host "`n[4/6] Firebase CLI..." -ForegroundColor Yellow
npm install -g firebase-tools
npm install -g @firebase/firestore-compat

# 5. GitHub CLI via scoop
Write-Host "`n[5/6] GitHub CLI..." -ForegroundColor Yellow
scoop install gh

# 6. FlutterFire CLI + packages globaux Dart
Write-Host "`n[6/6] FlutterFire CLI + outils Dart..." -ForegroundColor Yellow
dart pub global activate flutterfire_cli
dart pub global activate melos

# --- Vérification finale
Write-Host "`n=== Vérification ===" -ForegroundColor Cyan
flutter doctor -v

Write-Host "`n=== Prochaine étape ===" -ForegroundColor Green
Write-Host "1. Crée les 3 projets Firebase sur https://console.firebase.google.com :"
Write-Host "   voyaj-dev  |  voyaj-staging  |  voyaj-prod"
Write-Host "2. Dans ce dossier : flutterfire configure --project=voyaj-dev"
Write-Host "3. Ouvre VS Code : code ."
Write-Host "4. Dans le dossier mobile/ : flutter pub get"
Write-Host "5. Dans le dossier functions/ : npm install"
