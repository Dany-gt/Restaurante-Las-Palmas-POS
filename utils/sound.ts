let sharedAudioContext: AudioContext | null = null;
let isAudioUnlocked = false;

export const initAudio = () => {
    if (isAudioUnlocked) return;
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;

        if (!sharedAudioContext) {
            sharedAudioContext = new AudioContextClass();
        }

        if (sharedAudioContext.state === 'suspended') {
            sharedAudioContext.resume();
        }

        // Reproducir un sonido imperceptible para desbloquear Web Audio API
        const oscillator = sharedAudioContext.createOscillator();
        const gainNode = sharedAudioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(sharedAudioContext.destination);
        gainNode.gain.value = 0; // Silencio total
        oscillator.start(sharedAudioContext.currentTime);
        oscillator.stop(sharedAudioContext.currentTime + 0.001);

        // Reproducir un audio HTML5 vacío para desbloquear elementos <audio> (útil para MP3 personalizados)
        const emptyAudio = new Audio('data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq');
        emptyAudio.play().catch(() => { });

        isAudioUnlocked = true;
        console.log('🔊 Motor de audio desbloqueado correctamente.');
    } catch (error) {
        console.warn('No se pudo desbloquear el motor de audio:', error);
    }
};

export const playNotificationSound = () => {
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;

        if (!sharedAudioContext) {
            sharedAudioContext = new AudioContextClass();
        }

        if (sharedAudioContext.state === 'suspended') {
            sharedAudioContext.resume();
        }

        const oscillator = sharedAudioContext.createOscillator();
        const gainNode = sharedAudioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(sharedAudioContext.destination);

        // Configuración para un sonido tipo "Ding" agradable
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, sharedAudioContext.currentTime); // La5
        oscillator.frequency.exponentialRampToValueAtTime(440, sharedAudioContext.currentTime + 0.5); // La4

        gainNode.gain.setValueAtTime(0.3, sharedAudioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, sharedAudioContext.currentTime + 0.5);

        oscillator.start(sharedAudioContext.currentTime);
        oscillator.stop(sharedAudioContext.currentTime + 0.5);
    } catch (error) {
        console.error("Error playing notification sound:", error);
    }
};
