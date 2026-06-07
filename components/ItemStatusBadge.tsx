import React, { useState, useEffect } from 'react';
import { Clock, Flame, CheckCircle2 } from 'lucide-react';

interface ItemStatusBadgeProps {
    item: {
        status: string;
        created_at?: string;
        preparing_at?: string;
        is_offline?: boolean;
    };
    serverOffset?: number;
    tick?: number;
}

export const ItemStatusBadge: React.FC<ItemStatusBadgeProps> = ({ item, serverOffset = 0, tick = 0 }) => {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    if (item.is_offline) {
        return (
            <span className="flex items-center gap-1 bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded font-semibold uppercase tracking-tighter text-[10px] animate-pulse">
                <Clock size={12} /> SINCRONIZANDO... (Local)
            </span>
        );
    }

    const safeParseDate = (d: string | null | undefined) => {
        if (!d) return 0;
        const normalized = d.includes('T') ? d : d.replace(' ', 'T');
        const val = new Date(normalized).getTime();
        return isNaN(val) ? 0 : val;
    };

    useEffect(() => {
        const calculateTime = () => {
            let startTimeMs: number = 0;

            if (item.status === 'preparing' && item.preparing_at) {
                startTimeMs = safeParseDate(item.preparing_at);
            } else if (item.created_at) {
                startTimeMs = safeParseDate(item.created_at);
            }

            if (startTimeMs === 0) {
                setElapsedSeconds(0);
                return;
            }

            const rawCurrent = Date.now();
            const rawOffset = Number(serverOffset) || 0;
            let nowServerMs = rawCurrent + rawOffset;

            // Detect and fix Timezone Mismatch (6 hours)
            let diffInMs = nowServerMs - startTimeMs;
            const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
            if (diffInMs > 10800000) { // +3 hours
                diffInMs -= SIX_HOURS_MS;
            } else if (diffInMs < -10800000) { // -3 hours
                diffInMs += SIX_HOURS_MS;
            }

            const totalSeconds = Math.max(0, Math.floor(diffInMs / 1000));
            setElapsedSeconds(totalSeconds);
        };

        // 1. Initial Calculation
        calculateTime();

        // 2. Interval (only if not finished)
        if (item.status !== 'ready' && item.status !== 'delivered') {
            const interval = setInterval(calculateTime, 1000);
            return () => clearInterval(interval);
        }
    }, [item.status, item.preparing_at, item.created_at, serverOffset, tick]);

    const formatTime = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (item.status === 'ready' || item.status === 'delivered') {
        const start = item.preparing_at ? safeParseDate(item.preparing_at) : (item.created_at ? safeParseDate(item.created_at) : 0);
        const end = (item as any).ready_at ? safeParseDate((item as any).ready_at) : 0;
        let durationStr = '';

        if (start > 0 && end > 0) {
            const diff = Math.max(0, Math.floor((end - start) / 1000));
            durationStr = ` (${formatTime(diff)})`;
        }

        return (
            <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-semibold uppercase tracking-tighter text-[10px] animate-pulse">
                <CheckCircle2 size={12} /> ¡LISTO!{durationStr}
            </span>
        );
    }

    if (item.status === 'preparing') {
        return (
            <span className="flex items-center gap-1 bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-semibold uppercase tracking-tighter text-[10px]">
                <Flame size={12} className="animate-pulse" /> EN PREPARACIÓN ({formatTime(elapsedSeconds)})
            </span>
        );
    }

    // Default: Pendiente
    return (
        <span className="flex items-center gap-1 text-gray-300 font-medium uppercase tracking-wider text-[10px] mt-0.5">
            <Clock size={12} /> EN ESPERA ({formatTime(elapsedSeconds)})
        </span>
    );
};
