import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.laspalmas.admin',
    appName: 'Las Palmas Admin',
    webDir: 'dist',
    backgroundColor: '#0f1115',
    server: {
        url: 'https://restaurante-las-palmas-pos.vercel.app/?app=admin',
        cleartext: true
    },
    android: {
        allowMixedContent: true,
        backgroundColor: '#0f1115'
    }
};

export default config;
