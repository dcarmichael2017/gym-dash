import React, { useState, useEffect } from 'react';
import { X, Calendar, FileText, Scale, Loader2, ChevronRight } from 'lucide-react';
import { getLegalHistory } from '../../../../../packages/shared/api/firestore';

const LegalHistoryModal = ({ gymId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [activeTab, setActiveTab] = useState('waiver'); // 'waiver' | 'tos'

  useEffect(() => {
    const fetchHistory = async () => {
      const res = await getLegalHistory(gymId);
      if (res.success) {
        setHistory(res.history);
        if (res.history.length > 0) {
          setSelectedVersion(res.history[0]); // Select newest by default
        }
      }
      setLoading(false);
    };
    fetchHistory();
  }, [gymId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white p-6 rounded-xl flex items-center gap-3">
          <Loader2 className="animate-spin text-blue-600" /> Loading history...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl h-[80vh] rounded-2xl shadow-2xl flex overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* SIDEBAR: Version List */}
        <div className="w-1/3 border-r border-gray-200 bg-gray-50 flex flex-col">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
            <h2 className="font-bold text-gray-800">Version History</h2>
            <div className="text-xs font-mono text-gray-400">{history.length} versions</div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {history.length === 0 && (
              <div className="p-4 text-center text-sm text-gray-400">
                No history recorded yet.
              </div>
            )}
            
            {history.map((ver) => {
              const isSelected = selectedVersion?.id === ver.id;
              const dateLabel = ver.updatedAt?.toDate ? ver.updatedAt.toDate().toLocaleString() : 'Unknown Date';
              
              return (
                <button
                  key={ver.id}
                  onClick={() => setSelectedVersion(ver)}
                  className={`w-full text-left p-3 rounded-lg border transition-all group ${
                    isSelected 
                      ? 'bg-blue-50 border-blue-200 shadow-sm' 
                      : 'bg-white border-transparent hover:border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                      v{ver.version}
                    </span>
                    {isSelected && <ChevronRight size={14} className="text-blue-500" />}
                  </div>
                  <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                    <Calendar size={12} /> {dateLabel}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* MAIN CONTENT: Text Viewer */}
        <div className="flex-1 flex flex-col bg-white">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex gap-2">
               <button 
                 onClick={() => setActiveTab('waiver')}
                 className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                   activeTab === 'waiver' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'
                 }`}
               >
                 <Scale size={16} /> Liability Waiver
               </button>
               <button 
                 onClick={() => setActiveTab('tos')}
                 className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                   activeTab === 'tos' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'
                 }`}
               >
                 <FileText size={16} /> Terms of Service
               </button>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
              <X size={20} />
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-8 bg-white">
            {selectedVersion ? (
              <div className="max-w-3xl mx-auto">
                 <div className="mb-6 pb-4 border-b border-gray-100">
                    <h1 className="text-xl font-bold text-gray-900 mb-1">
                        {activeTab === 'waiver' ? 'Liability Waiver' : 'Terms of Service'}
                    </h1>
                    <p className="text-sm text-gray-400 font-mono">
                        Viewing Version {selectedVersion.version} • Archived on {selectedVersion.updatedAt?.toDate().toLocaleDateString()}
                    </p>
                 </div>
                 
                 <div className="prose prose-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-serif">
                    {activeTab === 'waiver' 
                        ? (selectedVersion.waiverText || "No waiver text saved for this version.") 
                        : (selectedVersion.tosText || "No TOS text saved for this version.")
                    }
                 </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-300">
                <FileText size={48} className="mb-4 opacity-50" />
                <p>Select a version to view details</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default LegalHistoryModal;