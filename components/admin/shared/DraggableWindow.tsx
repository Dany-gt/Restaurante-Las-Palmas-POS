import React, { useState, useEffect, useCallback } from 'react';

interface DraggableWindowProps {
    children: React.ReactNode;
    resizable?: boolean;
    defaultWidth?: number | string;
    defaultHeight?: number | string;
    minWidth?: number;
    minHeight?: number;
}

export const DraggableWindow: React.FC<DraggableWindowProps> = ({ 
    children, 
    resizable = true,
    defaultWidth = 800,
    defaultHeight = 'auto',
    minWidth = 400,
    minHeight = 300
}) => {
    // Determine initial sizes from child classes if possible
    const initialStyles = React.useMemo(() => {
        let w: number | string = defaultWidth;
        let h: number | string = defaultHeight;
        let mw: string | undefined = undefined;

        if (React.isValidElement(children)) {
            const className = children.props.className || '';
            const wMatch = className.match(/w-\[([0-9.]+(?:px|vw|rem|em|%))\]/);
            if (wMatch) w = wMatch[1];
            
            const hMatch = className.match(/h-\[([0-9.]+(?:px|vh|rem|em|%))\]/);
            if (hMatch) h = hMatch[1];

            const mwMatch = className.match(/max-w-([a-zA-Z0-9-]+)/);
            if (mwMatch) {
                const map: Record<string, string> = {
                    'xs': '20rem', 'sm': '24rem', 'md': '28rem', 'lg': '32rem', 'xl': '36rem',
                    '2xl': '42rem', '3xl': '48rem', '4xl': '56rem', '5xl': '64rem', '6xl': '72rem', '7xl': '80rem'
                };
                mw = map[mwMatch[1]] || undefined;
            }
        }
        return { w, h, mw };
    }, [children, defaultWidth, defaultHeight]);

    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [size, setSize] = useState<{ width: number | string, height: number | string }>({ width: initialStyles.w, height: initialStyles.h });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState<{ active: boolean; dir: string }>({ active: false, dir: '' });
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const containerRef = React.useRef<HTMLDivElement>(null);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.modal-header')) {
            setIsDragging(true);
            setOffset({
                x: e.clientX - position.x,
                y: e.clientY - position.y
            });
            document.body.style.userSelect = 'none';
        }
    }, [position]);

    const handleResizeMouseDown = useCallback((e: React.MouseEvent, dir: string) => {
        e.stopPropagation();
        e.preventDefault();
        
        // If size is 'auto', measure current size before starting resize
        let startWidth = typeof size.width === 'number' ? size.width : containerRef.current?.offsetWidth || 0;
        let startHeight = typeof size.height === 'number' ? size.height : containerRef.current?.offsetHeight || 0;

        setIsResizing({ active: true, dir });
        setResizeStart({ x: e.clientX, y: e.clientY, width: startWidth, height: startHeight });
        document.body.style.userSelect = 'none';
    }, [size]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - offset.x,
                y: e.clientY - offset.y
            });
        } else if (isResizing.active) {
            let newWidth = resizeStart.width;
            let newHeight = resizeStart.height;

            if (isResizing.dir.includes('e')) {
                newWidth = Math.max(minWidth, resizeStart.width + (e.clientX - resizeStart.x));
            }
            if (isResizing.dir.includes('s')) {
                newHeight = Math.max(minHeight, resizeStart.height + (e.clientY - resizeStart.y));
            }

            setSize({ width: newWidth, height: newHeight });
        }
    }, [isDragging, isResizing, offset, resizeStart, minWidth, minHeight]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setIsResizing({ active: false, dir: '' });
        document.body.style.userSelect = '';
    }, []);

    useEffect(() => {
        if (isDragging || isResizing.active) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing.active, handleMouseMove, handleMouseUp]);

    // Clone child to override classes
    let clonedChild = children;
    if (React.isValidElement(children)) {
        const className = children.props.className || '';
        let newClassName = className
            .replace(/\bw-\[[^\]]+\]\b/g, '')
            .replace(/\bh-\[[^\]]+\]\b/g, '')
            .replace(/\bmax-w-[a-zA-Z0-9-]+\b/g, '')
            .replace(/\bmax-h-\[[^\]]+\]\b/g, '')
            .replace(/\bw-[0-9a-zA-Z]+\b/g, (m: string) => m === 'w-full' ? '' : m) // remove w-full if exists
            .replace(/\bh-[0-9a-zA-Z]+\b/g, (m: string) => m === 'h-full' ? '' : m);
            
        newClassName = `${newClassName} w-full h-full`.trim();
        clonedChild = React.cloneElement(children as React.ReactElement, { className: newClassName });
    }

    return (
        <div 
            ref={containerRef}
            className="draggable-window-wrapper"
            style={{ 
                transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                transition: 'none',
                willChange: 'transform',
                width: resizable ? size.width : undefined,
                height: resizable ? size.height : undefined,
                maxWidth: initialStyles.mw ? initialStyles.mw : '100vw',
                maxHeight: '92vh',
                position: 'relative'
            }}
            onMouseDown={handleMouseDown}
        >
            <style>{`
                .draggable-window-wrapper > div > .overflow-y-auto,
                .draggable-window-wrapper > div > .overflow-auto,
                .draggable-window-wrapper > div > .custom-scrollbar {
                    max-height: none !important;
                    flex: 1 1 0% !important;
                }
            `}</style>
            {clonedChild}
            
            {resizable && (
                <>
                    {/* Right Handle */}
                    <div 
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize z-[9999999]"
                        onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
                        style={{ marginRight: '-4px' }}
                    />
                    {/* Bottom Handle */}
                    <div 
                        className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize z-[9999999]"
                        onMouseDown={(e) => handleResizeMouseDown(e, 's')}
                        style={{ marginBottom: '-4px' }}
                    />
                    {/* Bottom Right Corner */}
                    <div 
                        className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize z-[9999999]"
                        onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
                        style={{ marginRight: '-4px', marginBottom: '-4px' }}
                    />
                </>
            )}
        </div>
    );
};
