import React from 'react';
import { Users, TrendingUp, DollarSign, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
// Import the hook
import { useGymStats } from '../../../../../shared/hooks/useGymStats';

export const StatsWidget = ({ gymId }) => {
  const { 
    activeMembers, 
    trialingMembers, 
    mrrEstimate, 
    signupHistory, // <--- We now have this!
    loading 
  } = useGymStats(gymId);

  // --- Helper: Calculate Trends ---
  const calculateTrend = () => {
    if (!signupHistory || signupHistory.length === 0) return { pct: 0, newThisMonth: 0 };

    const now = new Date();
    // Key format matches the hook: "YYYY-MM"
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

    const thisMonth = signupHistory.find(h => h.date === currentKey)?.signups || 0;
    const prevMonth = signupHistory.find(h => h.date === lastKey)?.signups || 0;

    let pct = 0;
    if (prevMonth > 0) {
      pct = Math.round(((thisMonth - prevMonth) / prevMonth) * 100);
    } else if (thisMonth > 0) {
      pct = 100; // 100% growth if we had 0 last month
    }

    return { pct, newThisMonth: thisMonth };
  };

  const trend = calculateTrend();

  // Formatting currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <>
        <div className="h-32 bg-gray-50 rounded-xl animate-pulse"></div>
        <div className="h-32 bg-gray-50 rounded-xl animate-pulse"></div>
        <div className="h-32 bg-gray-50 rounded-xl animate-pulse"></div>
      </>
    );
  }

  return (
    <>
      {/* 1. MRR Estimate */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-gray-500">Est. MRR</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">
              {formatCurrency(mrrEstimate)}
            </h3>
          </div>
          <div className="p-2 bg-green-50 rounded-lg">
            <DollarSign className="h-5 w-5 text-green-600" />
          </div>
        </div>
        
        {/* Dynamic Trend Badge */}
        <div className="mt-4 flex items-center gap-2">
            {trend.pct !== 0 ? (
                <span className={`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 ${
                    trend.pct > 0 ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'
                }`}>
                    {trend.pct > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(trend.pct)}% growth
                </span>
            ) : (
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    Stable
                </span>
            )}
            <span className="text-xs text-gray-400">vs last mo</span>
        </div>
      </div>

      {/* 2. Active Members */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-gray-500">Active Members</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">{activeMembers}</h3>
          </div>
          <div className="p-2 bg-blue-50 rounded-lg">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
        </div>
        
        {/* New Signups Indicator */}
        <div className="mt-4 flex items-center text-xs text-gray-500">
           {trend.newThisMonth > 0 ? (
               <span className="text-blue-600 font-medium mr-1">
                   +{trend.newThisMonth} new
               </span>
           ) : (
               <span className="text-gray-400 mr-1">No signups</span>
           )}
           this month
        </div>
      </div>

      {/* 3. Trialing Members (Pipeline) */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-gray-500">In Trial</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">{trialingMembers}</h3>
          </div>
          <div className="p-2 bg-purple-50 rounded-lg">
            <Activity className="h-5 w-5 text-purple-600" />
          </div>
        </div>
        <div className="mt-4 text-xs text-purple-600 font-medium flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          Potential conversion
        </div>
      </div>
    </>
  );
};