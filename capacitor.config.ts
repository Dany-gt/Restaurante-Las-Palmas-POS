import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.laspalmas.pos',
    appName: 'Restaurante Las Palmas POS',
    webDir: 'dist',
    server: {
        url: 'https://restaurante-las-palmas-pos.vercel.app',
        cleartext: true
    }
};

export default config;
