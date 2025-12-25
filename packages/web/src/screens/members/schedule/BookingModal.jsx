import React, { useState, useEffect } from 'react';
import { Loader2, X, Calendar, Clock, AlertCircle, CheckCircle, Trash2, Hourglass, CheckSquare, User } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore'; // For fetching instructor if needed
import { db } from '../../../../../../packages/shared/api/firebaseConfig';
import { useGym } from '../../../context/GymContext'; // To get gymId for lookup

const BookingModal = ({ classInstance, onClose, onConfirm, onCancel, theme }) => {
  const { currentGym } = useGym();
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [instructorName, setInstructorName] = useState(classInstance.resolvedInstructorName || classInstance.instructorName || null);

  // --- FETCH INSTRUCTOR IF MISSING ---
  // Only runs if we don't have a name but we have an ID
  useEffect(() => {
    if (!instructorName && classInstance.instructorId && currentGym?.id) {
        const fetchInstructor = async () => {
            try {
                const docRef = doc(db, 'gyms', currentGym.id, 'staff', classInstance.instructorId);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setInstructorName(snap.data().name);
                }
            } catch (err) {
                console.error("Failed to fetch instructor for modal", err);
            }
        };
        fetchInstructor();
    }
  }, [classInstance, currentGym, instructorName]);

  // Derived state
  const isAttended = classInstance.userStatus === 'attended';
  const isBooked = classInstance.userStatus === 'booked';
  const isWaitlisted = classInstance.userStatus === 'waitlisted';
  const isFull = classInstance.maxCapacity && classInstance.currentCount >= parseInt(classInstance.maxCapacity);

  const getCheckInTime = () => {
      if (!classInstance.checkedInAt) return null;
      const date = classInstance.checkedInAt.toDate ? classInstance.checkedInAt.toDate() : new Date(classInstance.checkedInAt);
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const handleConfirm = async () => {
    setStatus('loading');
    setErrorMessage('');
    try {
      const result = await onConfirm(classInstance); 
      if (result.success) {
        setStatus('success');
        setSuccessMsg(result.status === 'waitlisted' ? "Added to Waitlist" : "Class Booked!");
        setTimeout(onClose, 1500);
      } else {
        setStatus('error');
        setErrorMessage(result.error || "Booking failed.");
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || "An unexpected error occurred.");
    }
  };

  const handleCancel = async () => {
    if (!classInstance.attendanceId) return;
    setStatus('loading');
    try {
      const result = await onCancel(classInstance.attendanceId);
      if (result.success) {
        setStatus('success');
        setSuccessMsg(isWaitlisted ? "Removed from Waitlist" : "Booking Cancelled");
        setTimeout(onClose, 1500);
      } else {
        setStatus('error');
        setErrorMessage(result.error || "Cancellation failed.");
      }
    } catch (err) {
        setStatus('error');
        setErrorMessage(err.message);
    }
  };

  const dateDisplay = new Date(classInstance.dateString + 'T12:00:00').toLocaleDateString('en-US', {
     weekday: 'long', month: 'long', day: 'numeric'
  });

  let title = "Confirm Booking";
  if (isAttended) title = "Class Completed";
  else if (isBooked) title = "Manage Booking";
  else if (isWaitlisted) title = "Waitlist Status";
  else if (isFull) title = "Class Full";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
           <h3 className="font-bold text-gray-900">{title}</h3>
           <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 text-gray-500">
             <X size={20} />
           </button>
        </div>

        {/* Content */}
        <div className="p-6">
           {status === 'success' ? (
              <div className="flex flex-col items-center justify-center py-4 text-center">
                 <div className={`h-12 w-12 rounded-full flex items-center justify-center mb-3 ${isBooked ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    {isBooked ? <Trash2 size={24}/> : <CheckCircle size={24} />}
                 </div>
                 <h4 className="text-xl font-bold text-gray-900">{successMsg}</h4>
              </div>
           ) : (
             <>
               <div className="mb-6">
                 <h2 className="text-lg font-bold text-gray-900 mb-1">{classInstance.name}</h2>
                 
                 {/* Instructor Badge */}
                 {instructorName && (
                    <div className="flex items-center gap-1.5 mb-4">
                        <div className="bg-gray-100 p-1 rounded-full">
                            <User size={12} className="text-gray-500" />
                        </div>
                        <span className="text-xs font-medium text-gray-600">{instructorName}</span>
                    </div>
                 )}

                 <div className="space-y-2 mt-3">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                       <Calendar size={16} className="text-gray-400" />
                       <span>{dateDisplay}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                       <Clock size={16} className="text-gray-400" />
                       <span>{classInstance.time} ({classInstance.duration} min)</span>
                    </div>
                    
                    {/* Status Context Info */}
                    {isAttended && (
                        <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                            <div className="flex justify-center mb-2">
                                <div className="bg-gray-200 p-2 rounded-full text-gray-600">
                                    <CheckSquare size={24} />
                                </div>
                            </div>
                            <p className="text-sm font-bold text-gray-800">You attended this class.</p>
                            {classInstance.checkedInAt && (
                                <p className="text-xs text-gray-500 mt-1">
                                    Checked in at {getCheckInTime()}
                                </p>
                            )}
                        </div>
                    )}

                    {isBooked && !isAttended && (
                        <div className="mt-2 text-xs font-medium text-green-700 bg-green-50 p-2 rounded border border-green-100 flex gap-2 items-center">
                            <CheckCircle size={12} /> You are currently booked for this class.
                        </div>
                    )}
                    {isWaitlisted && (
                        <div className="mt-2 text-xs font-medium text-orange-700 bg-orange-50 p-2 rounded border border-orange-100 flex gap-2 items-center">
                            <Hourglass size={12} /> You are on the waitlist.
                        </div>
                    )}
                    {isFull && !isBooked && !isWaitlisted && !isAttended && (
                         <div className="mt-2 text-xs font-medium text-red-700 bg-red-50 p-2 rounded border border-red-100 flex gap-2 items-center">
                            <AlertCircle size={12} /> This class is at capacity ({classInstance.currentCount}/{classInstance.maxCapacity}).
                         </div>
                    )}
                 </div>
               </div>

               {status === 'error' && (
                 <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{errorMessage}</span>
                 </div>
               )}

               {/* BUTTON LOGIC */}
               {!isAttended && (
                   <>
                       {isBooked || isWaitlisted ? (
                           <button
                             onClick={handleCancel}
                             disabled={status === 'loading'}
                             className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform bg-red-500 hover:bg-red-600"
                           >
                             {status === 'loading' ? <Loader2 className="animate-spin" /> : (isWaitlisted ? "Leave Waitlist" : "Cancel Booking")}
                           </button>
                       ) : (
                           <button
                             onClick={handleConfirm}
                             disabled={status === 'loading'}
                             className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
                             style={{ backgroundColor: isFull ? '#ea580c' : theme.primaryColor }}
                           >
                             {status === 'loading' ? <Loader2 className="animate-spin" /> : (isFull ? "Join Waitlist" : "Confirm Booking")}
                           </button>
                       )}
                   </>
               )}
               
               <button onClick={onClose} className="w-full py-3 mt-2 text-sm font-semibold text-gray-500 hover:text-gray-800">
                 Close
               </button>
             </>
           )}
        </div>
      </div>
    </div>
  );
};

export default BookingModal;