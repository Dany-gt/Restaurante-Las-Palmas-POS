const { spawn } = require('child_process');
const path = require('path');

// Copiamos el entorno actual y ELIMINAMOS la variable conflictiva
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.ELECTRON_START_URL = 'http://localhost:3000';

// Obtenemos la ruta real de electron
const electronPath = require('electron');

console.log('--- Iniciando Lanzador de Desarrollo Las Palmas ---');
console.log('Limpiando variable: ELECTRON_RUN_AS_NODE');

const child = spawn(`"${electronPath}"`, ['.'], {
    env,
    stdio: 'inherit',
    shell: true
});

child.on('close', (code) => {
    process.exit(code);
});
