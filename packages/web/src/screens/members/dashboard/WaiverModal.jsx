import React, { useState, useEffect } from 'react';
import { ScrollText, CheckCircle, Loader2, XCircle, Scale, FileText, X, History, ArrowLeft } from 'lucide-react';
import { getGymWaiver } from '../../../../../../packages/shared/api/firestore/gym'; 
import { useConfirm } from '../../../context/ConfirmationContext';
import { doc, getDoc } from 'firebase/firestore'; 
import { db } from '../../../../../../packages/shared/api/firebaseConfig';

const WaiverModal = ({ 
    gymId, 
    gymName, 
    onAccept, 
    onDecline, 
    onClose, 
    theme, 
    viewOnly = false,
    targetVersion = null, 
    lastSignedVersion = null, // NEW PROP: The version the user previously accepted
    isUpdate = false 
}) => {
  const { confirm } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // State to toggle between the NEW waiver and the OLD waiver
  const [viewingHistory, setViewingHistory] = useState(false);

  const [legalDocs, setLegalDocs] = useState({ waiver: '', tos: '', enforce: true, version: 0 });
  const [activeTab, setActiveTab] = useState('waiver'); 

  useEffect(() => {
    const fetchText = async () => {
      setLoading(true);
      
      // LOGIC:
      // 1. If we are explicitly in "viewingHistory" mode (toggled by user), fetch lastSignedVersion.
      // 2. If we are in "viewOnly" mode (Profile screen history), fetch targetVersion.
      // 3. Otherwise (Signing mode), fetch LIVE version (or targetVersion if provided).
      
      const fetchVersion = viewingHistory ? lastSignedVersion : targetVersion;
      const shouldFetchHistory = viewingHistory || (viewOnly && targetVersion);

      if (shouldFetchHistory && fetchVersion) {
          try {
             // Fetch specific version from history
             const histRef = doc(db, "gyms", gymId, "settings", "legal", "history", `v${fetchVersion}`);
             const snap = await getDoc(histRef);
             if (snap.exists()) {
                 const data = snap.data();
                 setLegalDocs({ 
                     waiver: data.waiverText, 
                     tos: data.tosText, 
                     enforce: true,
                     version: data.version
                 });
                 setLoading(false);
                 return;
             }
          } catch (e) {
              console.error("Failed to load historical waiver", e);
          }
      }

      // Default: Fetch LIVE version (for signing)
      const res = await getGymWaiver(gymId);
      if (res.success) {
          setLegalDocs({ 
              waiver: res.waiverText, 
              tos: res.tosText, 
              enforce: res.enforceWaiver,
              version: res.version
          });
      }
      setLoading(false);
    };
    
    fetchText();
  }, [gymId, targetVersion, viewOnly, viewingHistory, lastSignedVersion]);

  const handleAccept = async () => {
    setSubmitting(true);
    await onAccept();
  };

  const handleDecline = async () => {
    const message = isUpdate 
        ? "If you decline the updated terms, you will not be able to access the app functionality."
        : "Declining these terms will remove your connection to this gym.";

    const isConfirmed = await confirm({
        title: isUpdate ? "Decline Update?" : "Disconnect from Gym?",
        message: message,
        type: "danger",
        confirmText: isUpdate ? "I Understand" : "Disconnect",
        cancelText: "Go Back"
    });

    if (isConfirmed) {
        setSubmitting(true);
        try {
            await onDecline();
        } finally {
            setSubmitting(false);
        }
    }
  };

  // Helper to determine Title
  const getHeaderTitle = () => {
      if (viewingHistory) return `Previously Signed (v${legalDocs.version})`;
      if (viewOnly) return `Signed Terms (v${legalDocs.version})`;
      if (isUpdate) return "Terms Updated";
      return "Review & Sign";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in duration-200 relative">
        
        {/* Close button (only in viewOnly or History mode) */}
        {(viewOnly || viewingHistory) && (
            <button 
                onClick={viewingHistory ? () => setViewingHistory(false) : onClose} 
                className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 z-10"
            >
                <X size={16} />
            </button>
        )}

        {/* Header */}
        <div className="pt-6 pb-2 px-5 bg-white shrink-0 text-center">
           <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3 ${viewOnly || viewingHistory ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
              {viewOnly || viewingHistory ? <CheckCircle size={24} /> : <ScrollText size={24} />}
           </div>
           
           <h2 className="text-xl font-bold text-gray-900">
               {getHeaderTitle()}
           </h2>

           {/* Logic to Toggle History View */}
           {isUpdate && !viewingHistory && lastSignedVersion && (
               <button 
                  onClick={() => setViewingHistory(true)}
                  className="mt-2 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors inline-flex items-center gap-1"
               >
                  <History size={12} /> View previously signed version (v{lastSignedVersion})
               </button>
           )}

           {viewingHistory && (
               <button 
                  onClick={() => setViewingHistory(false)}
                  className="mt-2 text-xs font-medium text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors inline-flex items-center gap-1"
               >
                  <ArrowLeft size={12} /> Back to New Terms
               </button>
           )}

           <p className="text-sm text-gray-500 mt-3 mb-4">
             {viewingHistory 
                ? "You accepted this version on the date recorded in your profile."
                : (viewOnly 
                    ? `You accepted this version.` 
                    : (isUpdate ? `Please accept the updated terms (v${legalDocs.version}).` : `Please accept the terms for ${gymName}.`)
                  )
             }
           </p>

           {/* TABS */}
           <div className="flex p-1 bg-gray-100 rounded-lg">
               <button onClick={() => setActiveTab('waiver')} className={`flex-1 py-2 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${activeTab === 'waiver' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                   <Scale size={14} /> Liability Waiver
               </button>
               <button onClick={() => setActiveTab('tos')} className={`flex-1 py-2 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${activeTab === 'tos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                   <FileText size={14} /> Terms of Service
               </button>
           </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 border-y border-gray-100">
           {loading ? (
             <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400"/></div>
           ) : (
             <div className="prose prose-sm text-gray-600 whitespace-pre-wrap leading-relaxed text-xs">
               {activeTab === 'waiver' ? legalDocs.waiver : legalDocs.tos}
             </div>
           )}
        </div>

        {/* Footer */}
        <div className="p-5 bg-white shrink-0 space-y-3">
           {viewOnly || viewingHistory ? (
               <button onClick={viewingHistory ? () => setViewingHistory(false) : onClose} className="w-full py-3.5 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 flex items-center justify-center gap-2 transition-colors">
                   {viewingHistory ? "Back to New Terms" : "Close"}
               </button>
           ) : (
               <>
                   <button onClick={handleAccept} disabled={loading || submitting} className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md hover:opacity-90" style={{ backgroundColor: theme.primaryColor }}>
                     {submitting ? <Loader2 className="animate-spin" /> : <><CheckCircle size={18} /> I Agree to ALL Terms</>}
                   </button>
                   
                   <button onClick={handleDecline} disabled={loading || submitting} className="w-full py-3 rounded-xl font-medium text-red-600 bg-white border border-red-100 hover:bg-red-50 flex items-center justify-center gap-2 active:scale-95 transition-colors">
                     <XCircle size={18} /> {isUpdate ? "Decline" : "Decline & Disconnect"}
                   </button>
               </>
           )}
        </div>
      </div>
    </div>
  );
};

export default WaiverModal;
