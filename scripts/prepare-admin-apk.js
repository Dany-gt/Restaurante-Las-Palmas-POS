const fs = require('fs');
const path = require('path');

const root = process.cwd();
const configPath = path.join(root, 'capacitor.config.ts');
const adminConfigPath = path.join(root, 'capacitor.admin.config.ts');
const posConfigPath = path.join(root, 'capacitor.pos.config.ts');

const androidDir = path.join(root, 'android');
const androidAdminDir = path.join(root, 'android-admin');
const androidPosDir = path.join(root, 'android-pos');

async function prepareAdmin() {
    console.log('🚀 Preparando entorno para APK Administrador...');

    // 1. Backup POS config if not exists
    if (!fs.existsSync(posConfigPath)) {
        fs.copyFileSync(configPath, posConfigPath);
        console.log('✅ Respaldada configuración POS.');
    }

    // 2. Switch to Admin config
    fs.copyFileSync(adminConfigPath, configPath);
    console.log('✅ Activada configuración Admin.');

    // 3. Handle Android folders (This might fail if locked, but we try)
    try {
        if (fs.existsSync(androidDir) && !fs.existsSync(androidPosDir)) {
            // Rename current android to android-pos
            console.log('📦 Respaldando carpeta android (POS)...');
            // Using a system command to be more robust
            require('child_process').execSync('Rename-Item -Path "android" -NewName "android-pos"', { shell: 'powershell.exe' });
        }

        if (fs.existsSync(androidAdminDir)) {
            // Rename android-admin to android
            console.log('📦 Restaurando carpeta android-admin...');
            require('child_process').execSync('Rename-Item -Path "android-admin" -NewName "android"', { shell: 'powershell.exe' });
        }
    } catch (e) {
        console.warn('⚠️ No se pudo renombrar la carpeta android (probablemente abierta en Android Studio).');
        console.warn('   Si vas a crear la APK de cero, ignora esto.');
    }

    console.log('\n✨ Entorno listo.');
    console.log('👉 Ejecuta: npx cap add android (si es la primera vez)');
    console.log('👉 Ejecuta: npx cap sync android');
    console.log('👉 Abre Android Studio y construye la APK.');
}

prepareAdmin();
