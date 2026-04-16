import { useEffect } from 'react';

/**
 * useGlobalKeyboardNavigation
 * Implementa comportamiento de teclado global (Enter=Tab, Esc=Blur/Cerrar Modales)
 */
export const useGlobalKeyboardNavigation = () => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeElement = document.activeElement as HTMLElement;

            // --- HABILIDAD 'TAB' CON 'ENTER' ---
            if (e.key === 'Enter') {
                const isTextArea = activeElement.tagName === 'TEXTAREA';
                const isSubmitButton =
                    (activeElement.tagName === 'BUTTON' && (activeElement as HTMLButtonElement).type === 'submit') ||
                    (activeElement.tagName === 'INPUT' && (activeElement as HTMLInputElement).type === 'submit');

                // Lógica de Excepciones Nativa
                // No interferir si es un área de texto o un botón de envío
                if (isTextArea || isSubmitButton) {
                    return;
                }

                // Evitar el comportamiento nativo de Enter
                e.preventDefault();

                // Buscamos todos los elementos seleccionables y visibles
                const focusableElements = Array.from(
                    document.querySelectorAll('input, select, textarea, button, [tabindex="0"]')
                ).filter((el: any) => {
                    const style = window.getComputedStyle(el);
                    return (
                        !el.disabled &&
                        el.tabIndex !== -1 &&
                        style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        el.offsetParent !== null // Verifica si el elemento es visible
                    );
                }) as HTMLElement[];

                const currentIndex = focusableElements.indexOf(activeElement);
                const nextIndex = (currentIndex + 1) % focusableElements.length;

                if (focusableElements[nextIndex]) {
                    focusableElements[nextIndex].focus();
                }
            }

            // --- HABILIDAD 'ESC' ---
            if (e.key === 'Escape') {
                // 1. Limpia foco nativo para evitar entradas accidentales
                if (activeElement) {
                    activeElement.blur();
                }

                // 2. CERRAR_MODALES_AQUÍ:
                // Disparamos un evento personalizado que los modales pueden escuchar
                const closeEvent = new CustomEvent('global-close-request');
                window.dispatchEvent(closeEvent);

                console.log('Teclado: Solicitud de cierre global (Esc)');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
};
