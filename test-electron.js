console.log('--- PROCESS VERSIONS ---');
console.log('Context Type:', process.type);
console.log(JSON.stringify(process.versions, null, 2));

console.log('--- ELECTRON MODULE ---');
try {
    const electron = require('electron');
    console.log('Keys:', Object.keys(electron));
    console.log('Typeof app:', typeof electron.app);
} catch (e) {
    console.error('Error requiring electron:', e);
}

console.log('--- ENV VARS ---');
console.log('ELECTRON_RUN_AS_NODE:', process.env.ELECTRON_RUN_AS_NODE);

process.exit(0);
