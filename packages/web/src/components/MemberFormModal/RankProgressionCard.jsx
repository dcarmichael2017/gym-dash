// src/features/members/components/MemberFormModal/RankProgressionCard.jsx
import React from 'react';
import { CheckCircle, Star, User, Edit2, Trash2 } from 'lucide-react';

export const RankProgressionCard = ({ program, userRankData, onUpdate, onPromote, onRemove }) => {
  if (!program || !userRankData) return null;

  const currentRank = program.ranks.find(r => r.id === userRankData.rankId);
  if (!currentRank) return null;

  const nextRankIndex = program.ranks.findIndex(r => r.id === userRankData.rankId) + 1;
  const nextRank = program.ranks[nextRankIndex];

  // 1. Get raw numbers
  const totalCredits = parseInt(userRankData.credits || 0);
  const stripes = parseInt(userRankData.stripes || 0);
  const maxStripes = parseInt(currentRank.maxStripes || 0);
  
  // 2. Calculate BASES
  const currentRankBase = parseInt(currentRank.classesRequired || 0);
  
  // 3. RELATIVE Score (Credits earned since achieving this belt)
  const relativeCredits = Math.max(0, totalCredits - currentRankBase);

  // --- PROGRESS CALCULATION LOGIC ---
  let goalRelative = 0; 
  let nextLabel = "Max Rank";
  let progressPercent = 100;
  let isReadyForPromo = false;
  let classesToGo = 0;

  if (nextRank) {
    const nextRankReq = parseInt(nextRank.classesRequired || 0);
    const beltGap = nextRankReq - currentRankBase;
    const steps = maxStripes + 1; 
    const classesPerStep = Math.round(beltGap / steps);

    if (stripes < maxStripes) {
        // Goal is the NEXT stripe
        goalRelative = (stripes + 1) * classesPerStep;
        nextLabel = `Stripe ${stripes + 1}`;
    } else {
        // Goal is the NEXT belt
        goalRelative = beltGap;
        nextLabel = nextRank.name;
    }

    // Ensure we don't show negative classes if data is out of sync
    const currentStripeFloor = stripes * classesPerStep;
    const effectiveRelativeCredits = Math.max(relativeCredits, currentStripeFloor);

    classesToGo = Math.max(0, goalRelative - effectiveRelativeCredits);
    
    const stepSize = classesPerStep;
    const progressInStep = effectiveRelativeCredits - currentStripeFloor;
    
    progressPercent = Math.min(100, Math.max(0, (progressInStep / stepSize) * 100));
    
    if (classesToGo === 0) isReadyForPromo = true;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm relative overflow-hidden group hover:border-blue-300 transition-all">
      
      {/* --- CARD BODY --- */}
      <div className="p-4">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
                {/* Rank Color Dot */}
                <div className="w-12 h-12 rounded-full border border-gray-100 shadow-inner flex items-center justify-center font-bold text-sm text-white shrink-0" 
                    style={{ backgroundColor: currentRank.color || '#ccc', textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}>
                  {program.name.substring(0,1)}
                </div>
                <div>
                    <h4 className="font-bold text-gray-800 text-base">{program.name}</h4>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-0.5">
                        <span className="font-medium">{currentRank.name}</span>
                        {maxStripes > 0 && (
                            <div className="flex gap-1 ml-1">
                                {[...Array(maxStripes)].map((_, i) => (
                                    <div key={i} className={`w-1.5 h-4 rounded-sm ${i < stripes ? 'bg-black' : 'bg-gray-200'}`} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Count Badge */}
            <div className="text-right">
                <span className="block text-2xl font-bold text-gray-900 leading-none">
                    {relativeCredits}
                </span>
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">
                    Classes at Rank
                </span>
            </div>
          </div>

          {/* Progress Bar Section */}
          {nextRank ? (
            <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                    <span className="text-gray-500 flex items-center gap-1">
                        Next: <span className="text-gray-900">{nextLabel}</span>
                    </span>
                    {classesToGo > 0 ? (
                        <span className="text-indigo-600 font-bold">~{classesToGo} more classes</span>
                    ) : (
                        <span className="text-green-600 flex items-center gap-1 font-bold">
                            <CheckCircle size={12} /> Ready for Promotion
                        </span>
                    )}
                </div>
                
                <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${isReadyForPromo ? 'bg-green-500' : 'bg-indigo-500'}`} 
                        style={{ width: `${progressPercent}%` }} />
                </div>

                {isReadyForPromo && (
                    <button 
                        type="button"
                        onClick={() => onPromote(program.id, nextLabel)}
                        className="w-full mt-3 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 flex items-center justify-center gap-2 shadow-sm animate-pulse"
                    >
                        <Star size={14} /> Promote to {nextLabel}
                    </button>
                )}
            </div>
          ) : (
            <div className="mt-4 p-2 bg-gray-50 text-center rounded text-xs text-gray-400 border border-gray-100">
                <Star size={12} className="inline mr-1" /> Maximum Rank Achieved
            </div>
          )}
      </div>

      {/* --- CARD FOOTER ACTIONS --- */}
      <div className="bg-gray-50 border-t border-gray-100 p-2 flex justify-end gap-2">
         <button 
            type="button"
            onClick={onRemove}
            className="px-3 py-1.5 rounded text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1"
         >
            <Trash2 size={12} /> Remove
         </button>
         <button 
            type="button"
            onClick={onUpdate}
            className="px-3 py-1.5 rounded text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors flex items-center gap-1"
         >
            <Edit2 size={12} /> Edit Details
         </button>
      </div>

    </div>
  );
};