import React from 'react';
import { Mail, MessageSquare, BarChart2, Plus, TrendingUp, DollarSign, Info, Send } from 'lucide-react';

const StatCard = ({ title, value, change, icon: Icon, color }) => (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <p className="text-3xl font-bold text-gray-800 mt-2">{value}</p>
        {change && <p className="text-xs text-gray-400 mt-1">{change}</p>}
    </div>
);

const BroadcastCenterScreen = () => {
    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Broadcast Center</h1>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-blue-700 shadow-sm">
                    <Plus size={18} /> New Campaign
                </button>
            </div>

            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard title="Emails Sent (30d)" value="1,284" change="+15% from last month" icon={Mail} color="text-blue-500" />
                <StatCard title="Avg. Open Rate" value="48.2%" change="+2.1% from last month" icon={TrendingUp} color="text-green-500" />
                <StatCard title="Avg. Click Rate" value="12.7%" change="-0.5% from last month" icon={BarChart2} color="text-orange-500" />
                <StatCard title="SMS Segments (30d)" value="451" change="+8% from last month" icon={MessageSquare} color="text-purple-500" />
            </div>

            {/* Pricing Info */}
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-6 flex items-start gap-3">
                <DollarSign size={20} className="shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-bold">Usage-Based Pricing</h3>
                    <p className="text-sm">Campaigns are powered by integrated services like Twilio. Your estimated costs are:</p>
                    <ul className="text-xs list-disc list-inside mt-1 font-mono">
                        <li>Emails: ~$0.001 per email</li>
                        <li>SMS: ~$0.01 per message segment</li>
                    </ul>
                </div>
            </div>

            {/* Recent Campaigns List */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-bold text-gray-800">Recent Campaigns</h2>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left">
                        <tr>
                            <th className="px-4 py-2 font-semibold text-gray-500 uppercase">Campaign</th>
                            <th className="px-4 py-2 font-semibold text-gray-500 uppercase">Type</th>
                            <th className="px-4 py-2 font-semibold text-gray-500 uppercase">Recipients</th>
                            <th className="px-4 py-2 font-semibold text-gray-500 uppercase">Open / Click Rate</th>
                            <th className="px-4 py-2 font-semibold text-gray-500 uppercase">Sent</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {/* Sample Row 1 */}
                        <tr className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800">Holiday Schedule Update</td>
                            <td className="px-4 py-3"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">Email</span></td>
                            <td className="px-4 py-3 text-gray-600">All Members (258)</td>
                            <td className="px-4 py-3 text-gray-600">62% / 18%</td>
                            <td className="px-4 py-3 text-gray-500">Dec 20, 2025</td>
                        </tr>
                        {/* Sample Row 2 */}
                        <tr className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800">New Year's Promo</td>
                            <td className="px-4 py-3"><span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">SMS</span></td>
                            <td className="px-4 py-3 text-gray-600">Past Members (72)</td>
                            <td className="px-4 py-3 text-gray-600">- / 24%</td>
                            <td className="px-4 py-3 text-gray-500">Dec 28, 2025</td>
                        </tr>
                        {/* Sample Row 3 */}
                        <tr className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800">Competition Team Reminder</td>
                            <td className="px-4 py-3"><span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">SMS</span></td>
                            <td className="px-4 py-3 text-gray-600">Comp Team (14)</td>
                            <td className="px-4 py-3 text-gray-600">- / 45%</td>
                            <td className="px-4 py-3 text-gray-500">Jan 05, 2026</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BroadcastCenterScreen;
