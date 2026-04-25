import React, { useState, useEffect, useRef } from 'react';
import Keyboard from 'react-simple-keyboard';
import 'react-simple-keyboard/build/css/index.css';
import './VirtualKeyboard.css';

export const VirtualKeyboard: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [activeElement, setActiveElement] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const [isShift, setIsShift] = useState(false);
    const [isCaps, setIsCaps] = useState(false);
    const [showNumpadOnly, setShowNumpadOnly] = useState(false);
    const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

    // Refs for keyboard instances
    const keyboardMain = useRef<any>(null);
    const keyboardNumpad = useRef<any>(null);
    // Single source of truth for the current input value
    const currentValueRef = useRef('');
    // For detecting double taps on the Shift key
    const lastShiftTap = useRef<number>(0);

    // Orientation detection
    useEffect(() => {
        const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Internal dictionary for auto-correction (Spanish common words + local context)
    const DICTIONARY: Record<string, string> = {
        'avenida': 'Avenida',
        'avemidad': 'Avenida',
        'avenid': 'Avenida',
        'ave': 'Avenida',
        'calzada': 'Calzada',
        'diagonal': 'Diagonal',
        'calle': 'Calle',
        'vía': 'Vía',
        'via': 'Vía',
        'kilometro': 'Kilómetro',
        'km': 'Kilómetro',
        'direccion': 'Dirección',
        'telefono': 'Teléfono',
        'referencia': 'Referencia',
        'observacion': 'Observación',
        'guatemala': 'Guatemala',
        'zona': 'Zona',
        'zna': 'Zona',
        'colonia': 'Colonia',
        'circunvalacion': 'Circunvalación',
        'xincurvalacion': 'Circunvalación',
        'xincurvalaxion': 'Circunvalación',
        'circunbalaxion': 'Circunvalación',
        'cirmbalaxion': 'Circunvalación',
        'cirmbalacion': 'Circunvalación',
        'circunbalacion': 'Circunvalación',
        'milagro': 'Milagro',
        'basurero': 'Basurero',
        'frente': 'Frente',
        'ceviche': 'Ceviche',
        'cevicheria': 'Cevichería',
        'restaurante': 'Restaurante',
        'sociodad': 'Sociedad',
        'anonima': 'Anónima',
        'quichu': 'Quiché',
        'mixco': 'Mixco',
        'villa': 'Villa',
        'nueva': 'Nueva',
        'camino': 'Camino',
        'casa': 'Casa',
        'tienda': 'Tienda',
        'farmacia': 'Farmacia',
        'colegio': 'Colegio',
        'parque': 'Parque',
        'centro': 'Centro',
        'comercial': 'Comercial',
        'lote': 'Lote',
        'manzana': 'Manzana',
        'residencial': 'Residencial',
        'apartamento': 'Apartamento',
        'edificio': 'Edificio',
        'atras': 'Atrás',
        'arriba': 'Arriba',
        'abajo': 'Abajo',
        'izquierda': 'Izquierda',
        'derecha': 'Derecha',
        'pasaje': 'Pasaje',
        'entrada': 'Entrada',
        'salida': 'Salida',
        'esquina': 'Esquina',
        'iglesia': 'Iglesia',
        'estacion': 'Estación',
        'posada': 'Posada',
        'palmeras': 'Palmeras',
        'palmas': 'Palmas',
        'hacienda': 'Hacienda',
        'san': 'San',
        'santa': 'Santa',
        'antigua': 'Antigua',
        'retalhuleu': 'Retalhuleu',
        'retalhuelue': 'Retalhuleu',
        'retal': 'Retalhuleu',
        'reu': 'Retalhuleu',
        'escuintla': 'Escuintla',
        'quetzaltenango': 'Quetzaltenango',
        'xela': 'Quetzaltenango',
        'mazatenango': 'Mazatenango',
        'mazate': 'Mazatenango',
        'jose': 'José',
        'maria': 'María',
        'jesus': 'Jesús',
        'cristo': 'Cristo',
        'rey': 'Rey',
        'sector': 'Sector',
        'bloque': 'Bloque',
        'cerca': 'Cerca',
        'parada': 'Parada',
        'bus': 'Bus',
        'mercado': 'Mercado',
        'municipal': 'Municipal',
    };

    const applyAutoCorrectionAll = (text: string): string => {
        // Split by words and separators, keeping the separators
        const parts = text.split(/(\s+|[.,!?;:])/);
        let modified = false;
        let capitalizeNext = true; // Start with capital for the first word

        const newParts = parts.map(part => {
            // If it's a separator, check if we need to capitalize the next word
            if (part && (part.match(/^\s+$/) || part.match(/^[.,!?;:]$/))) {
                if (part.includes('.') || part.includes('!') || part.includes('?')) {
                    capitalizeNext = true;
                }
                return part;
            }

            // If it's a word
            if (part && part.length > 0) {
                const clean = part.toLowerCase().replace(/[.,!?;:]/g, '');
                let corrected = part;

                // 1. Check dictionary first
                if (DICTIONARY[clean]) {
                    corrected = DICTIONARY[clean];
                    modified = true;
                }
                // 2. Otherwise apply sentence case or auto-capitalization rules
                else if (capitalizeNext) {
                    corrected = part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
                    modified = true;
                }
                // 3. For any other word, ensure lowercase if not at start of sentence
                else {
                    // Only lowercase if it was all caps or mixed weirdly, 
                    // otherwise keep as is (to preserve manually capitalized names not in dict)
                    // corrected = part.toLowerCase(); 
                }

                capitalizeNext = false;
                return corrected;
            }
            return part;
        });

        return modified ? newParts.join('') : text;
    };

    // Utility: should we auto-capitalize given the current value?
    const shouldAutoCapitalize = (value: string): boolean => {
        if (value.length === 0) return true;
        const trimmed = value.trimEnd();
        if (trimmed.length === 0) return true;
        const lastChar = trimmed[trimmed.length - 1];
        return ['.', '!', '?'].includes(lastChar);
    };

    useEffect(() => {
        const handleInputInteraction = (e: Event) => {
            const target = e.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
            
            if (!isInput) return;

            const input = target as HTMLInputElement | HTMLTextAreaElement;

            // EXCLUSIONS
            if (['button', 'submit', 'checkbox', 'radio', 'hidden', 'file'].includes(input.type)) return;
            if (input.type === 'number' || input.type === 'tel' || input.hasAttribute('data-no-keyboard')) {
                setIsVisible(false);
                return;
            }

            setActiveElement(input);
            setIsVisible(true);

            // Auto-capitalize at start of input or after sentence-ending punctuation
            if (!showNumpadOnly) {
                const shouldCap = shouldAutoCapitalize(input.value);
                setIsShift(shouldCap);
            }

            // Suppress native OS keyboard ONLY on mobile/tablets, NOT on Electron/Desktop
            // This allows physical keyboard to work properly on desktop
            const isElectron = (window as any).electron;
            const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

            if (!isElectron && isTouchDevice) {
                input.setAttribute('inputmode', 'none');
            }

            // Determine mode
            if (input.type === 'number' || input.type === 'tel' || input.dataset.keyboard === 'numeric') {
                setShowNumpadOnly(true);
            } else {
                setShowNumpadOnly(false);
            }

            // Sync keyboard value immediately
            const val = input.value;
            currentValueRef.current = val;
            if (keyboardMain.current) keyboardMain.current.setInput(val);
            if (keyboardNumpad.current) keyboardNumpad.current.setInput(val);
        };

        // NEW: Listen for physical keyboard input to keep virtual keyboard state in sync
        const handlePhysicalInput = (e: Event) => {
            const target = e.target as HTMLInputElement;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                const val = target.value;
                currentValueRef.current = val;
                if (keyboardMain.current) keyboardMain.current.setInput(val);
                if (keyboardNumpad.current) keyboardNumpad.current.setInput(val);
            }
        };

        document.addEventListener('click', handleInputInteraction);
        document.addEventListener('touchstart', handleInputInteraction); // Para tablets
        document.addEventListener('input', handlePhysicalInput); // Sync physical typing

        return () => {
            document.removeEventListener('focusin', handleInputInteraction);
            document.removeEventListener('click', handleInputInteraction);
            document.removeEventListener('input', handlePhysicalInput);
        };
    }, []);

    const onChange = (input: string) => {
        if (!activeElement) return;

        // Automatically apply correction when space or punctuation is typed
        let finalInput = input;
        const lastTyped = input[input.length - 1];
        if ([' ', '.', ',', ';', '!', '?'].includes(lastTyped)) {
            finalInput = applyAutoCorrectionAll(input);
        }

        currentValueRef.current = finalInput;
        if (keyboardMain.current) keyboardMain.current.setInput(finalInput);
        if (keyboardNumpad.current) keyboardNumpad.current.setInput(finalInput);

        // Inject value into React input
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value"
        )?.set;
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            "value"
        )?.set;

        const setter = activeElement.tagName === 'INPUT' ? nativeInputValueSetter : nativeTextAreaValueSetter;

        if (setter) {
            setter.call(activeElement, finalInput);
            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            activeElement.value = finalInput;
        }

        // AUTO-CAPITALIZATION LOGIC
        if (isShift && !isCaps) {
            setIsShift(false);
        }

        if (!isCaps) {
            const nextShouldCap = shouldAutoCapitalize(finalInput);
            if (nextShouldCap !== isShift) {
                setIsShift(nextShouldCap);
            }
        }

        if (activeElement.spellcheck === false) {
            activeElement.spellcheck = true;
        }
    };

    const onChangeQwerty = (input: string) => {
        if (keyboardNumpad.current) keyboardNumpad.current.setInput(input);
        onChange(input);
    };

    const onChangeNumpad = (button: string) => {
        if (!activeElement) return;

        // Custom handling for numpad buttons to ensure they insert at cursor
        if (button.match(/^[0-9]$/)) {
            const start = activeElement.selectionStart || 0;
            const end = activeElement.selectionEnd || 0;
            const val = currentValueRef.current;
            const newVal = val.slice(0, start) + button + val.slice(end);

            // Move cursor forward
            setTimeout(() => {
                activeElement.setSelectionRange(start + 1, start + 1);
            }, 0);

            onChange(newVal);
        } else if (button === '{backspace}') {
            const start = activeElement.selectionStart || 0;
            const end = activeElement.selectionEnd || 0;
            const val = currentValueRef.current;
            let newVal = val;
            let newPos = start;

            if (start !== end) {
                newVal = val.slice(0, start) + val.slice(end);
                newPos = start;
            } else if (start > 0) {
                newVal = val.slice(0, start - 1) + val.slice(start);
                newPos = start - 1;
            }

            setTimeout(() => {
                activeElement.setSelectionRange(newPos, newPos);
            }, 0);

            onChange(newVal);
        } else if (button === '{enter}') {
            handleClose();
        } else {
            onChange(keyboardNumpad.current.getInput());
        }
    };

    const onKeyPress = (button: string) => {
        if (button === '{enter}') {
            setIsVisible(false);
            if (activeElement) {
                activeElement.blur();
            }
        }
        if (button === '{shift}') {
            const now = Date.now();
            if (now - lastShiftTap.current < 400) {
                setIsCaps(true);
                setIsShift(false);
                lastShiftTap.current = 0;
            } else {
                if (isCaps) {
                    setIsCaps(false);
                    setIsShift(false);
                } else {
                    setIsShift(prev => !prev);
                }
                lastShiftTap.current = now;
            }
        }
        if (button === '{close}') {
            setIsVisible(false);
        }
    };

    const handleClose = () => {
        setIsVisible(false);
    };

    // Layout Definitions
    const numpadLayout = {
        default: [
            "7 8 9",
            "4 5 6",
            "1 2 3",
            "{backspace} 0 {enter}"
        ]
    };

    const qwertyLayoutLandscape = {
        default: [
            "q w e r t y u i o p {backspace}",
            "a s d f g h j k l {enter}",
            "{shift} z x c v b n m , . /",
            "{space}"
        ],
        shift: [
            "Q W E R T Y U I O P {backspace}",
            "A S D F G H J K L {enter}",
            "{shift} Z X C V B N M < > ?",
            "{space}"
        ]
    };

    const qwertyLayoutPortrait = {
        default: [
            "1 2 3 4 5 6 7 8 9 0 {backspace}",
            "q w e r t y u i o p {enter}",
            "a s d f g h j k l",
            "{shift} z x c v b n m , . /",
            "{space}"
        ],
        shift: [
            "1 2 3 4 5 6 7 8 9 0 {backspace}",
            "Q W E R T Y U I O P {enter}",
            "A S D F G H J K L",
            "{shift} Z X C V B N M < > ?",
            "{space}"
        ]
    };

    const qwertyLayout = isPortrait ? qwertyLayoutPortrait : qwertyLayoutLandscape;

    const display = {
        '{backspace}': '⌫',
        '{enter}': '↵',
        '{shift}': '<svg viewBox="0 0 24 24" width="22" height="22" class="keyboard-shift-svg"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
        '{space}': 'ESPACIO'
    };

    const mainLayoutName = (isShift || isCaps) ? 'shift' : 'default';

    // Dragging Logic
    const [position, setPosition] = useState<{ x: number, y: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
    const keyboardRef = useRef<HTMLDivElement>(null);

    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        if (!keyboardRef.current) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        const rect = keyboardRef.current.getBoundingClientRect();
        setPosition({ x: rect.left, y: rect.top });
        dragOffset.current = { x: clientX - rect.left, y: clientY - rect.top };
        setIsDragging(true);
    };

    useEffect(() => {
        let requestRef: number;

        const handlePointerMove = (e: MouseEvent | TouchEvent) => {
            if (!isDragging || !keyboardRef.current) return;
            e.preventDefault();

            const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

            const newX = clientX - dragOffset.current.x;
            const newY = clientY - dragOffset.current.y;

            if (requestRef) cancelAnimationFrame(requestRef);

            requestRef = requestAnimationFrame(() => {
                if (keyboardRef.current) {
                    keyboardRef.current.style.left = `${newX}px`;
                    keyboardRef.current.style.top = `${newY}px`;
                    keyboardRef.current.style.bottom = 'auto';
                    keyboardRef.current.style.transform = 'none';
                    keyboardRef.current.style.transition = 'none';
                }
            });
        };

        const handlePointerUp = (e: MouseEvent | TouchEvent) => {
            if (!isDragging) return;

            const clientX = 'touches' in e ? (e as TouchEvent).changedTouches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? (e as TouchEvent).changedTouches[0].clientY : (e as MouseEvent).clientY;

            setPosition({ x: clientX - dragOffset.current.x, y: clientY - dragOffset.current.y });
            setIsDragging(false);

            if (keyboardRef.current) {
                keyboardRef.current.style.transition = '';
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', handlePointerMove, { passive: false });
            window.addEventListener('touchmove', handlePointerMove, { passive: false });
            window.addEventListener('mouseup', handlePointerUp);
            window.addEventListener('touchend', handlePointerUp);
        }
        return () => {
            window.removeEventListener('mousemove', handlePointerMove);
            window.removeEventListener('touchmove', handlePointerMove);
            window.removeEventListener('mouseup', handlePointerUp);
            window.removeEventListener('touchend', handlePointerUp);
            if (requestRef) cancelAnimationFrame(requestRef);
        };
    }, [isDragging]);

    const containerStyle: React.CSSProperties = position
        ? {
            left: `${position.x}px`,
            top: `${position.y}px`,
            transform: 'none',
            bottom: 'auto',
            display: isVisible ? 'flex' : 'none'
        }
        : {};

    return (
        <div
            ref={keyboardRef}
            className={`keyboard-container ${isVisible ? 'visible' : ''} ${showNumpadOnly ? 'numpad-only' : ''} ${isPortrait ? 'portrait' : ''}`}
            style={containerStyle}
        >
            <div
                className="keyboard-header"
                onMouseDown={handlePointerDown}
                onTouchStart={handlePointerDown}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
                <span className="keyboard-title">Teclado Virtual {isCaps ? '(MAYÚS)' : ''}</span>
                <button
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleClose(); }}
                    onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleClose(); }}
                    className="keyboard-close-btn"
                >
                    Cerrar
                </button>
            </div>

            <div className="keyboard-body">
                {!showNumpadOnly && (
                    <div className="keyboard-main">
                        <Keyboard
                            keyboardRef={r => (keyboardMain.current = r)}
                            layoutName={mainLayoutName}
                            onChange={onChangeQwerty}
                            onKeyPress={onKeyPress}
                            layout={qwertyLayout}
                            display={display}
                            preventMouseDownDefault={true}
                            buttonTheme={[
                                {
                                    class: "hg-button-shift-toggled",
                                    buttons: (isShift && !isCaps) ? "{shift}" : ""
                                },
                                {
                                    class: "hg-button-caps-locked",
                                    buttons: isCaps ? "{shift}" : ""
                                }
                            ].filter(t => t.buttons !== "")}
                        />
                    </div>
                )}

                {(!isPortrait || showNumpadOnly) && (
                    <div className={`keyboard-numpad ${showNumpadOnly ? 'w-full max-w-none border-l-0' : ''}`}>
                        <Keyboard
                            keyboardRef={r => (keyboardNumpad.current = r)}
                            onKeyPress={onChangeNumpad}
                            layout={numpadLayout}
                            display={display}
                            preventMouseDownDefault={true}
                            theme="hg-theme-default hg-layout-numeric"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
