const fs = require('fs');
const path = require('path');

const root = process.cwd();
const configPath = path.join(root, 'capacitor.config.ts');
const posConfigPath = path.join(root, 'capacitor.pos.config.ts');

const androidDir = path.join(root, 'android');
const androidAdminDir = path.join(root, 'android-admin');
const androidPosDir = path.join(root, 'android-pos');

async function preparePos() {
    console.log('🚀 Restaurando entorno para APK POS...');

    // 1. Switch back to POS config
    if (fs.existsSync(posConfigPath)) {
        fs.copyFileSync(posConfigPath, configPath);
        console.log('✅ Restaurada configuración POS.');
    }

    // 2. Handle Android folders
    try {
        if (fs.existsSync(androidDir) && !fs.existsSync(androidAdminDir)) {
            // Rename current android (admin) to android-admin
            console.log('📦 Respaldando carpeta android (Admin)...');
            require('child_process').execSync('Rename-Item -Path "android" -NewName "android-admin"', { shell: 'powershell.exe' });
        }

        if (fs.existsSync(androidPosDir)) {
            // Rename android-pos to android
            console.log('📦 Restaurando carpeta android-pos...');
            require('child_process').execSync('Rename-Item -Path "android-pos" -NewName "android"', { shell: 'powershell.exe' });
        }
    } catch (e) {
        console.warn('⚠️ No se pudo renombrar la carpeta android.');
    }

    console.log('\n✨ Entorno POS listo.');
}

preparePos();
