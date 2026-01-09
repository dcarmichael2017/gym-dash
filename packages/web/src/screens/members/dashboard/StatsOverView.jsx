import React, { useMemo } from 'react';
import { TrendingUp, Award, Calendar, Loader2 } from 'lucide-react';

const calculateBaseCredits = (program, rankId, stripeCount) => {
    if (!program || !rankId || !program.ranks) return 0;
    
    const currentRank = program.ranks.find(r => r.id === rankId);
    if (!currentRank) return 0;

    const baseReq = parseInt(currentRank.classesRequired || 0);
    
    if (stripeCount <= 0) return baseReq;

    const nextRankIndex = program.ranks.findIndex(r => r.id === rankId) + 1;
    const nextRank = program.ranks[nextRankIndex];
    
    if (nextRank) {
        const nextReq = parseInt(nextRank.classesRequired || 0);
        const gap = nextReq - baseReq;
        const maxStripes = parseInt(currentRank.maxStripes || 0);
        const steps = maxStripes + 1;
        
        if (steps === 0) return baseReq;
        const perStep = Math.round(gap / steps);
        
        return baseReq + (stripeCount * perStep);
    }

    return baseReq;
};


const StatsOverView = ({ user, gym, attendanceHistory, onClick, loading }) => {
    const progressData = useMemo(() => {
        if (!user || !gym?.grading?.programs || !attendanceHistory) {
            return { hasData: false, attendedThisMonth: 0 };
        }

        const attended = attendanceHistory.filter(h => h.status === 'attended');
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const attendedThisMonth = attended.filter(h => h.classTimestamp.toDate() >= startOfMonth).length;

        const userRanks = user.ranks || {};
        const programIds = Object.keys(userRanks);
        if (programIds.length === 0) {
            return { hasData: false, attendedThisMonth };
        }
        
        const mainProgramId = programIds[0];
        const userRankData = userRanks[mainProgramId];
        const program = gym.grading.programs.find(p => p.id === mainProgramId);
        if (!program || !program.ranks?.length) return { hasData: false, attendedThisMonth };

        const currentRank = program.ranks.find(r => r.id === userRankData.rankId);
        if (!currentRank) return { hasData: false, attendedThisMonth };
        
        const currentRankIndex = program.ranks.findIndex(r => r.id === currentRank.id);
        const nextRank = program.ranks[currentRankIndex + 1];
        const maxStripes = parseInt(currentRank.maxStripes || 0);
        const currentStripes = userRankData.stripes || 0;
        const currentCredits = userRankData.credits || 0;
        
        let milestoneStart = 0;
        let milestoneEnd = 0;
        let milestoneLabel = 'Next Goal';
        
        const rankStartCredits = calculateBaseCredits(program, currentRank.id, 0);

        if (currentStripes < maxStripes) {
            milestoneStart = calculateBaseCredits(program, currentRank.id, currentStripes);
            milestoneEnd = calculateBaseCredits(program, currentRank.id, currentStripes + 1);
            milestoneLabel = `Stripe ${currentStripes + 1}`;
        } else if (nextRank) {
            milestoneStart = rankStartCredits;
            milestoneEnd = parseInt(nextRank.classesRequired || 0);
            milestoneLabel = `${nextRank.name}`;
        } else {
            milestoneStart = rankStartCredits;
            milestoneEnd = currentCredits > rankStartCredits ? currentCredits : rankStartCredits + 1;
        }
        
        const totalInRange = milestoneEnd - milestoneStart;
        const progressInRange = currentCredits - milestoneStart;
        const percentage = totalInRange > 0 ? Math.max(0, Math.min(100, (progressInRange / totalInRange) * 100)) : 100;
        const classesNeeded = Math.max(0, milestoneEnd - currentCredits);

        return {
            hasData: true,
            attendedThisMonth,
            programName: program.name,
            rankName: currentRank.name,
            rankColor: currentRank.color,
            stripes: currentStripes,
            maxStripes: maxStripes,
            percentage,
            classesNeeded,
            milestoneLabel
        };
    }, [user, gym, attendanceHistory]);

    if (loading) {
        return (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-40 flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-gray-300" />
            </div>
        );
    }
    
    return (
        <div 
            onClick={onClick}
            className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 space-y-3 cursor-pointer active:scale-[0.98] transition-transform duration-150"
        >
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{progressData.programName || 'My Progress'}</p>
                    <div className="flex items-center gap-2 mt-1">
                        {progressData.rankColor && (
                            <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: progressData.rankColor }} />
                        )}
                        <h3 className="font-bold text-lg text-gray-800">{progressData.rankName || 'Not Ranked'}</h3>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs font-bold text-gray-400 uppercase">Stripes</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                        {[...Array(progressData.maxStripes || 0)].map((_, i) => (
                            <div 
                                key={i} 
                                className={`w-1.5 h-4 rounded-sm ${i < progressData.stripes ? 'bg-gray-800' : 'bg-gray-200'}`} 
                            />
                        ))}
                        {progressData.maxStripes === 0 && <span className="text-xs text-gray-400">-</span>}
                    </div>
                </div>
            </div>

            {progressData.hasData ? (
                <>
                    <div>
                        <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                            <div 
                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${progressData.percentage}%` }}
                            />
                        </div>
                        <div className="flex justify-between items-center mt-1.5 px-0.5">
                            <p className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                                <TrendingUp size={12} />
                                {progressData.classesNeeded > 0 ? `${progressData.classesNeeded} classes to ${progressData.milestoneLabel}` : `Goal Achieved!`}
                            </p>
                            <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                <Calendar size={12} />
                                {progressData.attendedThisMonth} this month
                            </p>
                        </div>
                    </div>
                </>
            ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                    Attend a class to start tracking your progress!
                </div>
            )}
        </div>
    );
};

export default StatsOverView;
