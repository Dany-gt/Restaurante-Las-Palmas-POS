import React, { useState, useEffect, useCallback } from 'react';

interface DraggableWindowProps {
    children: React.ReactNode;
}

export const DraggableWindow: React.FC<DraggableWindowProps> = ({ children }) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        // Only trigger drag if clicking the header
        const target = e.target as HTMLElement;
        if (target.closest('.modal-header')) {
            setIsDragging(true);
            setOffset({
                x: e.clientX - position.x,
                y: e.clientY - position.y
            });
            // Prevent text selection during drag
            document.body.style.userSelect = 'none';
        }
    }, [position]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - offset.x,
            y: e.clientY - offset.y
        });
    }, [isDragging, offset]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        document.body.style.userSelect = '';
    }, []);

    useEffect(() => {
        if (isDragging) {
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
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <div 
            style={{ 
                transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                transition: 'none',
                willChange: 'transform'
            }}
            onMouseDown={handleMouseDown}
        >
            {children}
        </div>
    );
};
