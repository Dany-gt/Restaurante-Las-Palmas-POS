import React, { useState, useEffect } from 'react';

interface KitchenTimerProps {
    startDate: string; // ISO string
    endDate?: string; // Optional ISO string to stop the timer
    warningThresholdMinutes?: number; // Default 15
    dangerThresholdMinutes?: number; // Default 20
    serverOffset?: number; // Adjustment for clock drift
    tick?: number; // External ticker to force re-render
}

export const KitchenTimer: React.FC<KitchenTimerProps> = ({
    startDate,
    endDate,
    warningThresholdMinutes = 15,
    dangerThresholdMinutes = 25,
    serverOffset = 0,
    tick = 0
}) => {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    useEffect(() => {
        const parseDate = (d: string) => {
            if (!d) return 0;
            // Respect server's local time: NO MORE 'Z' suffix
            const normalized = d.includes('T') ? d : d.replace(' ', 'T');
            const val = new Date(normalized).getTime();
            return isNaN(val) ? 0 : val;
        };

        const calculateTime = () => {
            const rawCurrent = Date.now();
            const rawOffset = Number(serverOffset) || 0;
            const startTime = parseDate(startDate);

            if (startTime !== 0) {
                // Determine point of reference (Current time or static end date)
                let targetEndMs = endDate ? parseDate(endDate) : (rawCurrent + rawOffset);
                let diffInMs = targetEndMs - startTime;

                // Detect and fix Timezone Mismatch (6 hours)
                const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
                if (diffInMs > 10800000) { // +3 hours
                    diffInMs -= SIX_HOURS_MS;
                } else if (diffInMs < -10800000) { // -3 hours
                    diffInMs += SIX_HOURS_MS;
                }

                // Final elapsed time (always positive)
                const totalSeconds = Math.max(0, Math.floor(diffInMs / 1000));

                if (totalSeconds % 60 === 0 && !endDate) {
                    console.log(`KDS TIMER [${startDate}]: Active at ${totalSeconds}s`);
                }

                setElapsedSeconds(totalSeconds);
            }
        };

        // 1. Initial Calculation
        calculateTime();

        // 2. Interval updates (Force re-render every second)
        const interval = setInterval(() => {
            calculateTime();
        }, 1000);

        return () => clearInterval(interval);
    }, [startDate, endDate, serverOffset, tick]);

    const formatTime = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        // Classic HH:MM:SS format
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const getStatusColor = (totalSeconds: number) => {
        // High visibility red for kitchen
        return 'bg-red-600';
    };

    return (
        <div className={`mx-auto px-3 py-1 rounded-md font-semibold text-white ${getStatusColor(elapsedSeconds)} shadow-lg shadow-red-900/20`}>
            <span className="leading-none text-lg tabular-nums tracking-tighter">
                {formatTime(elapsedSeconds)}
            </span>
        </div>
    );
};
