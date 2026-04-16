export const speak = (text: string, volume: number = 1.0): void => {
    if (!('speechSynthesis' in window)) return;

    // Cancelar cualquier lectura anterior para evitar superposiciones
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX'; // Español latino (más claro)
    utterance.rate = 0.85;    // Más lento para que se entienda bien
    utterance.pitch = 1.0;
    utterance.volume = volume;

    // Intentar usar una voz en español de buena calidad
    const voices = window.speechSynthesis.getVoices();
    const spanishVoices = voices.filter(v => v.lang.startsWith('es'));
    const preferred =
        spanishVoices.find(v => (v.name.includes('Google') || v.name.includes('Natural')) && v.lang === 'es-419') ||
        spanishVoices.find(v => (v.name.includes('Google') || v.name.includes('Natural')) && v.lang === 'es-MX') ||
        spanishVoices.find(v => v.name.includes('Google') || v.name.includes('Natural')) ||
        spanishVoices.find(v => v.lang === 'es-419') ||
        spanishVoices.find(v => v.lang === 'es-MX') ||
        spanishVoices[0];

    if (preferred) {
        utterance.voice = preferred;
        utterance.lang = preferred.lang;
    }

    window.speechSynthesis.speak(utterance);
};

/**
 * Habla DESPUÉS de que un audio termine de sonar.
 * @param audio - El elemento HTMLAudioElement que debe terminar primero
 * @param text  - El texto que se dirá después
 */
export const speakAfterAudio = (audio: HTMLAudioElement, text: string, volume: number = 1.0): void => {
    audio.addEventListener('ended', () => {
        // Pequeña pausa de 400ms para que no se empalme
        setTimeout(() => speak(text, volume), 400);
    }, { once: true });
};

export const cancelSpeech = () => {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
};
