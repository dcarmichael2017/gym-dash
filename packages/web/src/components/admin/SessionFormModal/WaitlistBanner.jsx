import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const WaitlistBanner = ({ activeCount, waitlistCount, liveCapacity, onProcess }) => {
    const effectiveLimit = liveCapacity === 0 ? 999 : liveCapacity;
    const gapDetected = activeCount < effectiveLimit && waitlistCount > 0;

    if (!gapDetected) return null;

    const spotsOpen = effectiveLimit - activeCount;
    const canPromote = Math.min(spotsOpen, waitlistCount);

    return (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3 text-yellow-800">
                <div className="p-1.5 bg-yellow-100 rounded-full">
                    <AlertTriangle size={16} />
                </div>
                <div className="text-xs">
                    <p className="font-bold">Spots Available!</p>
                    <p>Capacity increased. Promote waitlist?</p>
                </div>
            </div>
            <button 
                onClick={onProcess}
                className="text-xs bg-white border border-yellow-300 text-yellow-800 px-3 py-1.5 rounded-md font-bold hover:bg-yellow-100 transition-colors shadow-sm"
            >
                Promote Top {canPromote}
            </button>
        </div>
    );
};