import React, { useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar 
} from 'recharts';
import { useOutletContext } from 'react-router-dom';
import { TrendingUp, DollarSign } from 'lucide-react';
import { useGymStats } from '../../../../shared/hooks/useGymStats';
import { FullScreenLoader } from '../../components/layout/FullScreenLoader';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const DashboardAnalyticsScreen = () => {
  const { gymId } = useOutletContext();

  const { 
    activeMembers, 
    mrrEstimate, 
    demographics, 
    signupHistory,   // Real Signup Data
    tierDistribution, // Real Plan Data
    loading,
  } = useGymStats(gymId);

  // --- REAL CHART DATA GENERATOR ---
  // Calculates cumulative growth over the last 6 months using real signup dates
  const historyData = useMemo(() => {
    if (loading) return [];
    
    const data = [];
    const now = new Date();
    
    // We want the last 6 months
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('default', { month: 'short' });

        // Calculate Cumulative Signups up to this month
        // (Note: This is an approximation for "Total Active" since we don't have churn history yet)
        const cumulativeSignups = signupHistory
            .filter(h => h.date <= key)
            .reduce((sum, h) => sum + h.signups, 0);

        // Approximate Revenue (Avg Revenue per User * Count)
        // We use current Average Revenue Per User (ARPU) to project backwards
        const arpu = activeMembers > 0 ? (mrrEstimate / activeMembers) : 0;
        
        data.push({
            name: label,
            Members: cumulativeSignups,
            Revenue: Math.round(cumulativeSignups * arpu)
        });
    }
    return data;
  }, [loading, signupHistory, activeMembers, mrrEstimate]);

  const demographicData = [
    { name: 'Adults', value: demographics.adults },
    { name: 'Dependents', value: demographics.dependents },
  ];

  if (loading) return <FullScreenLoader />;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Analytics Command Center</h2>
        <p className="text-gray-500">Deep dive into your gym's performance.</p>
      </div>

      {/* --- ROW 1: GROWTH CHARTS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart A: Member Growth */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <div>
                <h3 className="font-bold text-gray-800">Member Growth</h3>
                <p className="text-xs text-gray-400">Total Active Members (Last 6 Months)</p>
            </div>
            <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData}>
                <defs>
                  <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} allowDecimals={false} />
                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Area type="monotone" dataKey="Members" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorMembers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart B: Revenue Trend */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <div>
                <h3 className="font-bold text-gray-800">Revenue Health</h3>
                <p className="text-xs text-gray-400">Monthly Recurring Revenue (Est.)</p>
            </div>
            <div className="bg-green-50 p-2 rounded-lg text-green-600">
                <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                    formatter={(value) => [`$${value}`, 'Revenue']}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Line type="monotone" dataKey="Revenue" stroke="#10B981" strokeWidth={3} dot={{r: 4, fill: '#10B981'}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* --- ROW 2: DEMOGRAPHICS & BREAKDOWNS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Widget 1: Age & Demographics */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-1">
            <h3 className="font-bold text-gray-800 mb-1">Demographics</h3>
            <p className="text-xs text-gray-400 mb-6">Member Age Breakdown</p>
            
            <div className="h-48 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={demographicData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {demographicData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
                {/* Center Text Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-gray-800">{demographics.avgAge || 0}</span>
                    <span className="text-xs text-gray-400 uppercase font-bold">Avg Age</span>
                </div>
            </div>
            
            <div className="mt-4 flex justify-center gap-6">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#3B82F6]"></div>
                    <span className="text-sm text-gray-600">Adults ({demographics.adults})</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#10B981]"></div>
                    <span className="text-sm text-gray-600">Kids ({demographics.dependents})</span>
                </div>
            </div>
        </div>

        {/* Widget 2: Membership Distribution (REAL DATA) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-2">
            <h3 className="font-bold text-gray-800 mb-1">Plan Distribution</h3>
            <p className="text-xs text-gray-400 mb-6">Active Members by Tier</p>
            
            <div className="h-60">
                {tierDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={tierDistribution} layout="vertical" margin={{top: 5, right: 30, left: 40, bottom: 5}}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12, fill: '#4B5563'}} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px'}} />
                            <Bar dataKey="value" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <p>No active plans yet.</p>
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardAnalyticsScreen;