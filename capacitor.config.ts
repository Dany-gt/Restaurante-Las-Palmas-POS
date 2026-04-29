import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.laspalmas.pos',
    appName: 'Restaurante Las Palmas POS',
    webDir: 'dist',
    backgroundColor: '#0f1115',
    server: {
        url: 'https://restaurante-las-palmas-pos.vercel.app',
        cleartext: true
    },
    android: {
        allowMixedContent: true,
        backgroundColor: '#0f1115'
    }
};

export default config;
