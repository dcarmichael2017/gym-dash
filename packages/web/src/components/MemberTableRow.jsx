// packages/web/src/components/MemberTableRow.jsx

import React from 'react';
import { 
    CheckCircle2, XCircle, Clock, Trash2, Edit2, Archive, 
    Link as LinkIcon, Users, User 
} from 'lucide-react';

export const MemberTableRow = ({ member, allMembers, onEdit, onDelete }) => {
    
    // --- Helper: Find Payer ---
    const payer = member.payerId ? allMembers.find(m => m.id === member.payerId) : null;

    // --- Helper: Status Badge ---
    const getStatusBadge = () => {
        const status = member.subscriptionStatus || member.status || 'inactive';
        switch(status) {
            case 'active': return <span className="flex items-center text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full w-fit"><CheckCircle2 className="w-3 h-3 mr-1"/> Active</span>;
            case 'trialing': return <span className="flex items-center text-xs font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded-full w-fit"><Clock className="w-3 h-3 mr-1"/> Trial</span>;
            case 'past_due': return <span className="flex items-center text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full w-fit"><XCircle className="w-3 h-3 mr-1"/> Past Due</span>;
            case 'archived': return <span className="flex items-center text-xs font-bold text-gray-600 bg-gray-200 px-2 py-1 rounded-full w-fit"><Archive className="w-3 h-3 mr-1"/> Archived</span>;
            case 'prospect': return <span className="text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full w-fit">Prospect</span>;
            default: return <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full w-fit">Inactive</span>;
        }
    };

    return (
        <tr onClick={() => onEdit(member)} className="hover:bg-gray-50 transition-colors group cursor-pointer">
            {/* 1. Member Info */}
            <td className="px-6 py-4">
                <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3 overflow-hidden">
                        {member.photoUrl ? (
                            <img src={member.photoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                            (member.firstName?.[0] || 'U')
                        )}
                    </div>
                    <div>
                        <p className="font-medium text-gray-900">{member.firstName} {member.lastName}</p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                    </div>
                </div>
            </td>

            {/* 2. Status */}
            <td className="px-6 py-4">
                {getStatusBadge()}
            </td>

            {/* 3. Plan Name */}
            <td className="px-6 py-4 text-sm text-gray-600">
                {member.membershipName || <span className="text-gray-400 italic">None</span>}
            </td>

            {/* 4. Family Status */}
            <td className="px-6 py-4">
                {member.payerId ? (
                    <div className="flex flex-col items-start">
                        <div className="flex items-center text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md w-fit mb-1">
                            <LinkIcon className="h-3 w-3 mr-1" /> Dependent
                        </div>
                        {payer ? (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation(); // Stop row click
                                    onEdit(payer);       // Edit PARENT instead
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                            >
                                of {payer.firstName} {payer.lastName}
                            </button>
                        ) : (
                            <span className="text-xs text-red-400">of Unknown</span>
                        )}
                    </div>
                ) : member.dependents && member.dependents.length > 0 ? (
                    <div className="flex items-center text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md w-fit border border-blue-100">
                        <Users className="h-3 w-3 mr-1" /> Head of Household
                    </div>
                ) : (
                    <span className="text-xs text-gray-400">-</span>
                )}
            </td>

            {/* 5. Actions */}
            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end gap-2">
                    <button 
                        onClick={() => onEdit(member)}
                        className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-colors"
                    >
                        <Edit2 className="h-4 w-4" />
                    </button>
                    <button 
                        onClick={() => onDelete(member)}
                        className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                    >
                        {member.status === 'active' ? <Archive className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                </div>
            </td>
        </tr>
    );
};