import React, { useState, useEffect } from 'react';
import { Loader2, X, Calendar, Clock, AlertCircle, CheckCircle, Trash2, Hourglass, CheckSquare, User, Scale, Coins, ShoppingCart, ArrowRight, Ticket, ShieldCheck, Lock, Star, ChevronRight, List, Info, Ban } from 'lucide-react'; // Added Info icon
import { useNavigate } from 'react-router-dom';
import { auth } from '../../../../../../packages/shared/api/firebaseConfig';
import { useGym } from '../../../context/GymContext';
import { getGymWaiver, signWaiver, checkBookingEligibility } from '../../../../../../packages/shared/api/firestore';
import { useConfirm } from '../../../context/ConfirmationContext';

const BookingModal = ({ classInstance, onClose, onConfirm, onCancel, theme }) => {
  const navigate = useNavigate();
  const { currentGym, memberships } = useGym();
  const { confirm } = useConfirm();

  const [status, setStatus] = useState('loading_data');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [data, setData] = useState({
    instructorName: classInstance.resolvedInstructorName || classInstance.instructorName || null,
    userProfile: null,
    eligibility: null,
    activePlanName: '',
    weeklyUsage: null,
    eligiblePublicPlans: []
  });
  const [showWaiver, setShowWaiver] = useState(false);
  const [waiverData, setWaiverData] = useState(null);

  // --- Extract Rules for Display ---

  // 🔍 DEBUG: Check if we have the snapshot
  console.log("Modal Instance Data:", classInstance);

  // If the user is booked, we MUST use the snapshot attached to their booking.
  // Otherwise, we use the current live class rules.
  const rules = (classInstance.userStatus === 'booked' && classInstance.bookingRulesSnapshot)
    ? classInstance.bookingRulesSnapshot
    : (classInstance.bookingRules || {});

  // Default to 2 hours if undefined, but respect 0
  const cancelHours = rules.cancelWindowHours !== undefined ? parseFloat(rules.cancelWindowHours) : 2;
  const lateFee = rules.lateCancelFee ? parseFloat(rules.lateCancelFee) : 0;

  // 👇 ADD THESE TWO LINES 👇
  const duration = parseInt(classInstance.duration) || 60;
  const lateBookingMinutes = rules.lateBookingMinutes !== undefined ? parseInt(rules.lateBookingMinutes) : duration;

  // --- ✅ FIX: Handle Auto-Close with Cleanup ---
  useEffect(() => {
    let timer;
    if (status === 'success') {
      timer = setTimeout(() => {
        onClose();
      }, 1500);
    }
    return () => clearTimeout(timer);
  }, [status, onClose]);

  useEffect(() => {
    const initData = async () => {
      if (!auth.currentUser || !currentGym) return;
      try {
        const res = await checkBookingEligibility(currentGym.id, auth.currentUser.uid, classInstance);
        if (res.success) {
          setData(res.data);
          setStatus('idle');
        } else {
          setStatus('error');
          setErrorMessage("Failed to load booking details.");
        }
      } catch (err) {
        setStatus('error');
        setErrorMessage(err.message);
      }
    };
    initData();
  }, [classInstance, currentGym]);

  const { instructorName, userProfile, eligibility: bookingEligibility, activePlanName, weeklyUsage, eligiblePublicPlans } = data;

  const isAttended = classInstance.userStatus === 'attended';
  const isBooked = classInstance.userStatus === 'booked';
  const isWaitlisted = classInstance.userStatus === 'waitlisted';
  const isFull = classInstance.maxCapacity && classInstance.currentCount >= parseInt(classInstance.maxCapacity);

  const dateDisplay = new Date(classInstance.dateString + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });

  const goToStore = (category) => {
    onClose();
    navigate('/members/store', { state: { category } });
  };

  const executeBooking = async () => {
    setStatus('loading');
    setErrorMessage('');
    try {
      const typeToBook = bookingEligibility?.type || 'membership';
      const costToCharge = bookingEligibility?.cost || 0;

      const result = await onConfirm(classInstance, {
        bookingType: typeToBook,
        creditCostOverride: costToCharge,
        waiveCost: false
      });

      if (result.success) {
        setSuccessMsg(result.status === 'waitlisted' ? "Added to Waitlist" : "Class Booked!");
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage(result.error || "Booking failed.");
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || "An unexpected error occurred.");
    }
  };

  const handlePreBookingCheck = async () => {
    if (isBooked || isWaitlisted) { handleCancel(); return; }

    if (bookingEligibility && !bookingEligibility.allowed && !isFull) {
      if (bookingEligibility.cost > 0) goToStore('packs');
      else goToStore('memberships');
      return;
    }

    setStatus('loading');
    try {
      const res = await getGymWaiver(currentGym.id);
      if (res.success && res.enforceWaiver) {
        const myMembership = memberships?.find(m => m.gymId === currentGym.id);
        const hasSigned = myMembership?.waiverSigned;
        const userVersion = myMembership?.waiverSignedVersion || 0;
        const requiredVersion = res.version || 1;
        if (!hasSigned || userVersion < requiredVersion) {
          setWaiverData({ text: res.waiverText, version: requiredVersion });
          setShowWaiver(true);
          setStatus('idle');
          return;
        }
      }
    } catch (e) { console.error("Waiver check failed", e); }
    executeBooking();
  };

  const handleSignAndBook = async () => {
    setStatus('loading');
    const user = auth.currentUser;
    try {
      if (user && currentGym && waiverData) {
        await signWaiver(user.uid, currentGym.id, waiverData.version);
      }
      setShowWaiver(false);
      await executeBooking();
    } catch (err) {
      setStatus('error');
      setErrorMessage("Failed to sign waiver.");
      setShowWaiver(false);
    }
  };

  const handleCancel = async () => {
    if (!classInstance.attendanceId) return;

    const costUsed = classInstance.cost || 0;
    const paidWithCredit = costUsed > 0;

    // Use fetched rules or legacy field
    const windowHours = cancelHours;
    const CANCELLATION_WINDOW_MIN = windowHours * 60;

    const [year, month, day] = classInstance.dateString.split('-').map(Number);
    const [hours, minutes] = classInstance.time.split(':').map(Number);
    const classDateObj = new Date(year, month - 1, day, hours, minutes);
    const now = new Date();
    const diffMs = classDateObj - now;
    const diffMinutes = Math.floor(diffMs / 60000);

    const isLateCancel = diffMinutes < CANCELLATION_WINDOW_MIN;

    let confirmTitle = "Cancel Booking";
    let confirmMessage = "Are you sure you want to cancel this booking?";
    let confirmBtnText = "Yes, Cancel";
    let modalType = "danger";
    let resultingSuccessMsg = "Booking Cancelled";

    if (isWaitlisted) {
      confirmTitle = "Leave Waitlist";
      confirmMessage = "You will be removed from the waitlist.";
      confirmBtnText = "Leave Waitlist";
      modalType = "confirm";
      if (paidWithCredit) {
        confirmMessage += ` Your ${costUsed} credit(s) will be refunded.`;
        resultingSuccessMsg = "Removed & Credit Refunded";
      }
    }
    else if (isLateCancel) {
      confirmTitle = "Late Cancellation";

      // Determine message based on penalty type (Credit Loss vs Fee)
      if (paidWithCredit) {
        confirmMessage = `You are cancelling within the ${windowHours > 0 ? windowHours + '-hour' : 'restricted'} window. You will NOT receive a refund for your ${costUsed} credit(s).`;
        confirmBtnText = `Forfeit Credit & Cancel`;
        resultingSuccessMsg = "Cancelled (Credit Forfeited)";
      } else {
        confirmMessage = `You are cancelling within the ${windowHours > 0 ? windowHours + '-hour' : 'restricted'} window. This will be recorded as a Late Cancellation.`;
        if (lateFee > 0) {
          confirmMessage += ` A fee of $${lateFee.toFixed(2)} may be charged to your account.`;
        }
        confirmBtnText = "Accept & Cancel";
        resultingSuccessMsg = "Late Cancellation Recorded";
      }
    }
    else {
      if (paidWithCredit) {
        confirmTitle = "Cancel & Refund";
        confirmMessage = `You are cancelling safely outside the window. Your ${costUsed} credit(s) will be immediately refunded to your account.`;
        confirmBtnText = `Refund Credit & Cancel`;
        modalType = "confirm";
        resultingSuccessMsg = "Cancelled & Credit Refunded";
      } else {
        confirmMessage = "You are cancelling outside the window. There is no penalty.";
      }
    }

    const isConfirmed = await confirm({
      title: confirmTitle,
      message: confirmMessage,
      type: modalType,
      confirmText: confirmBtnText,
      cancelText: "Keep Booking"
    });

    if (!isConfirmed) return;

    setStatus('loading');
    try {
      const result = await onCancel(classInstance.attendanceId);
      if (result.success) {
        setSuccessMsg(resultingSuccessMsg);
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage(result.error || "Cancellation failed.");
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message);
    }
  };

  const renderWeeklySchedule = () => {
    if (!weeklyUsage || !weeklyUsage.classes || weeklyUsage.classes.length === 0) return null;
    
    return (
      <div className="mt-3 bg-gray-50 rounded-lg border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2">
        <div className="px-3 py-2 bg-gray-100/50 border-b border-gray-200 flex justify-between items-center">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <List size={10} /> Your Schedule this Week
          </span>
          <span className="text-[10px] font-bold text-gray-700">{weeklyUsage.used}/{weeklyUsage.limit}</span>
        </div>
        <div className="max-h-32 overflow-y-auto divide-y divide-gray-100">
          {weeklyUsage.classes.map((cls) => {
            const [y, m, d] = cls.dateString.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const dayStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
            // Check if this specific item is a Late Cancel
            const isLateCancel = cls.status === 'cancelled' && cls.lateCancel;

            return (
              <div key={cls.id} className="px-3 py-2 flex justify-between items-center text-xs hover:bg-white transition-colors">
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold truncate ${isLateCancel ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                      {cls.className}
                    </span>
                    
                    {/* VISUAL INDICATOR FOR LATE CANCEL */}
                    {isLateCancel && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">
                        <Ban size={8} /> Late Cancel
                      </span>
                    )}
                  </div>
                  <span className="text-gray-400 text-[10px]">{dayStr}</span>
                </div>
                
                <div className={`whitespace-nowrap font-medium px-1.5 py-0.5 rounded border ${isLateCancel ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {cls.classTime}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ... (Loaders for waiver and data remain the same) ...
  if (status === 'loading_data') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white p-6 rounded-xl shadow-xl flex items-center gap-3">
          <Loader2 className="animate-spin text-blue-600" />
          <span className="font-medium text-gray-700">Checking eligibility...</span>
        </div>
      </div>
    );
  }

  if (showWaiver && waiverData) {
    // ... (Waiver modal code remains same) ...
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-200">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div className="flex items-center gap-2 text-gray-900 font-bold">
              <Scale size={20} className="text-blue-600" />
              <h3>Waiver Required</h3>
            </div>
            <button onClick={() => { setShowWaiver(false); setStatus('idle'); }} className="p-1 rounded-full hover:bg-gray-200 text-gray-500"><X size={20} /></button>
          </div>
          <div className="p-4 bg-blue-50 text-blue-800 text-xs font-medium border-b border-blue-100">
            To book this class, you must accept the updated liability waiver.
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            <div className="prose prose-sm text-gray-600 whitespace-pre-wrap text-xs">{waiverData.text}</div>
          </div>
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <button onClick={handleSignAndBook} disabled={status === 'loading'} className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md" style={{ backgroundColor: theme.primaryColor }}>
              {status === 'loading' ? <Loader2 className="animate-spin" /> : "Agree & Book Class"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  let displayTitle = "Confirm Booking";
  if (isAttended) displayTitle = "Class Completed";
  else if (isBooked) displayTitle = "Manage Booking";
  else if (isWaitlisted) displayTitle = "Waitlist Status";
  else if (isFull) displayTitle = "Class Full";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">

        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-900">{displayTitle}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 text-gray-500"><X size={20} /></button>
        </div>

        <div className="p-6">
          {status === 'success' ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center mb-3 ${isBooked ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {isBooked ? <Trash2 size={24} /> : <CheckCircle size={24} />}
              </div>
              <h4 className="text-xl font-bold text-gray-900">{successMsg}</h4>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-1">{classInstance.name}</h2>

                {instructorName && (
                  <div className="flex items-center gap-1.5 mb-4">
                    <div className="bg-gray-100 p-1 rounded-full"><User size={12} className="text-gray-500" /></div>
                    <span className="text-xs font-medium text-gray-600">{instructorName}</span>
                  </div>
                )}

                <div className="space-y-2 mt-3">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Calendar size={16} className="text-gray-400" /><span>{dateDisplay}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Clock size={16} className="text-gray-400" /><span>{classInstance.time} ({classInstance.duration} min)</span>
                  </div>

                  {/* ✅ NEW: Class Policies Section (Booking/Cancel Rules) */}
                  {!isAttended && !isBooked && !isWaitlisted && (
                    <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
                      {classInstance.userStatus === 'booked' && classInstance.bookingRulesSnapshot && (
                        <div className="col-span-2 mb-2">
                          <div className="bg-blue-50 text-blue-700 text-[10px] px-2 py-1 rounded border border-blue-100 flex items-center gap-1">
                            <ShieldCheck size={10} />
                            <span className="font-bold">Price & Policy Guarantee:</span>
                            <span>You are locked into the rules from when you booked.</span>
                          </div>
                        </div>
                      )}
                      {/* Cancellation Policy */}
                      <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-1.5 text-gray-900 font-bold text-xs mb-1">
                          <AlertCircle size={12} className="text-blue-500" />
                          <span>Cancellation</span>
                        </div>
                        <p className="text-[10px] text-gray-500 leading-tight">
                          {cancelHours > 0
                            ? `Free cancel up to ${cancelHours}h before start.`
                            : "Cancel freely until class starts."
                          }
                          {lateFee > 0 && <span className="text-red-600 font-semibold block mt-0.5">Late Fee: ${lateFee.toFixed(2)}</span>}
                        </p>
                      </div>

                      {/* Late Booking Policy */}
                      <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-1.5 text-gray-900 font-bold text-xs mb-1">
                          <Clock size={12} className="text-green-600" />
                          <span>Late Entry</span>
                        </div>
                        <p className="text-[10px] text-gray-500 leading-tight">
                          {lateBookingMinutes >= duration
                            ? "Book anytime until class ends."
                            : lateBookingMinutes === 0
                              ? "Booking closes strictly at start time."
                              : `Booking closes ${lateBookingMinutes}m after start.`
                          }
                        </p>
                      </div>
                    </div>
                  )}

                  {isAttended && (
                    <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                      <div className="flex justify-center mb-2"><div className="bg-gray-200 p-2 rounded-full text-gray-600"><CheckSquare size={24} /></div></div>
                      <p className="text-sm font-bold text-gray-800">You attended this class.</p>
                    </div>
                  )}
                  {isBooked && !isAttended && (
                    <div className="mt-2 text-xs font-medium text-green-700 bg-green-50 p-2 rounded border border-green-100 flex gap-2 items-center"><CheckCircle size={12} /> You are currently booked for this class.</div>
                  )}
                  {isWaitlisted && (
                    <div className="mt-2 text-xs font-medium text-orange-700 bg-orange-50 p-2 rounded border border-orange-100 flex gap-2 items-center"><Hourglass size={12} /> You are on the waitlist.</div>
                  )}

                  {/* ... (Existing Logic for Plans/Credits) ... */}
                  {!isBooked && !isWaitlisted && !isAttended && bookingEligibility && (
                    <div className="mt-4 space-y-3">
                      {bookingEligibility.allowed && bookingEligibility.type === 'membership' && (
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                          <div className="flex items-start gap-3">
                            <div className="bg-blue-100 p-1.5 rounded-full mt-0.5"><ShieldCheck size={16} className="text-blue-600" /></div>
                            <div className="w-full">
                              <p className="text-sm font-bold text-blue-900">Covered by Membership</p>
                              <p className="text-xs text-blue-700 mt-0.5">Included with your {activePlanName || "active plan"}.</p>
                              {weeklyUsage && (
                                <div className="mt-3 p-2 bg-blue-100/50 rounded-lg border border-blue-200">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] uppercase font-bold text-blue-700">Weekly Progress</span>
                                    <span className="text-[10px] font-bold text-blue-900">{weeklyUsage.used} / {weeklyUsage.limit}</span>
                                  </div>
                                  <div className="w-full bg-blue-200 rounded-full h-1.5">
                                    <div
                                      className={`h-1.5 rounded-full ${weeklyUsage.used >= weeklyUsage.limit ? 'bg-orange-500' : 'bg-blue-600'}`}
                                      style={{ width: `${Math.min((weeklyUsage.used / weeklyUsage.limit) * 100, 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {bookingEligibility.allowed && bookingEligibility.type === 'drop-in' && bookingEligibility.cost === 0 && (
                        <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                          <div className="flex items-start gap-3">
                            <div className="bg-green-100 p-1.5 rounded-full mt-0.5"><Ticket size={16} className="text-green-600" /></div>
                            <div>
                              <p className="text-sm font-bold text-green-900">Open Registration</p>
                              <p className="text-xs text-green-700 mt-0.5">Free to book.</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {bookingEligibility.allowed && bookingEligibility.type === 'credit' && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          {bookingEligibility.reason && bookingEligibility.reason.toLowerCase().includes('limit') && (
                            <div className="mb-3 pb-3 border-b border-gray-200">
                              <div className="flex gap-2 items-start text-orange-700 mb-2">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-bold">Weekly Limit Reached</p>
                                  <p className="text-xs mt-1 text-orange-800 leading-relaxed">
                                    You have used your <span className="font-bold">{weeklyUsage?.limit || 'weekly'}</span> classes for this week.
                                  </p>
                                </div>
                              </div>
                              {renderWeeklySchedule()}
                              <div className="mt-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Booking this class requires:
                              </div>
                            </div>
                          )}

                          <div className="flex justify-between items-center text-sm mb-1">
                            <span className="text-gray-600 flex items-center gap-1"><Coins size={14} /> Credit Cost:</span>
                            <span className="font-bold text-gray-900">{bookingEligibility.cost}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Remaining Balance:</span>
                            <span className="font-bold text-green-600">
                              {(userProfile?.classCredits || 0)} <ArrowRight size={12} className="inline mx-1" /> {(userProfile?.classCredits || 0) - bookingEligibility.cost}
                            </span>
                          </div>
                        </div>
                      )}

                      {!bookingEligibility.allowed && bookingEligibility.cost > 0 && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                          <div className="flex gap-2 items-center text-red-700 font-bold text-sm mb-2">
                            <AlertCircle size={16} /> Insufficient Credits
                          </div>
                          {bookingEligibility.reason && bookingEligibility.reason.toLowerCase().includes('limit') && (
                            <div className="mb-3">
                              <p className="text-xs text-red-800 mb-2">
                                You reached your weekly limit of <span className="font-bold">{weeklyUsage?.limit}</span> classes. You need credits to book more.
                              </p>
                              {renderWeeklySchedule()}
                            </div>
                          )}
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="text-gray-600">Cost:</span>
                            <span className="font-medium">{bookingEligibility.cost} Credit(s)</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">Your Balance:</span>
                            <span className="font-bold text-red-600">{userProfile?.classCredits || 0} Credits</span>
                          </div>
                        </div>
                      )}

                      {!bookingEligibility.allowed && bookingEligibility.cost === 0 && (
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                          <div className="bg-gray-50 p-3 border-b border-gray-100">
                            <div className="flex gap-2 items-center text-gray-800 font-bold text-sm mb-1">
                              <Lock size={16} className="text-orange-500" />
                              <span>
                                {bookingEligibility.reason.toLowerCase().includes('limit')
                                  ? "Weekly Limit Reached"
                                  : bookingEligibility.reason.includes('currently')
                                    ? "Membership Unavailable"
                                    : "Membership Required"
                                }
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">
                              {bookingEligibility.reason.toLowerCase().includes('limit')
                                ? `You have used your ${weeklyUsage?.limit || ''} classes for this week.`
                                : bookingEligibility.reason.includes('currently')
                                  ? bookingEligibility.reason
                                  : `This class is exclusive to members. ${eligiblePublicPlans.length > 0 ? "Unlock access below:" : "Contact staff to join."}`
                              }
                            </p>
                            {bookingEligibility.reason.toLowerCase().includes('limit') && renderWeeklySchedule()}
                          </div>
                          {eligiblePublicPlans.length > 0 && !bookingEligibility.reason.toLowerCase().includes('limit') && (
                            <div className="divide-y divide-gray-100">
                              {eligiblePublicPlans.map(plan => (
                                <button key={plan.id} onClick={() => goToStore('memberships')} className="w-full flex justify-between items-center p-3 hover:bg-blue-50 transition-colors group text-left">
                                  <div>
                                    <div className="text-sm font-bold text-gray-900 group-hover:text-blue-700 flex items-center gap-1.5"><Star size={12} className="text-yellow-400 fill-yellow-400" />{plan.name}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">${plan.price}/{plan.interval === 'one_time' ? 'once' : plan.interval}</div>
                                  </div>
                                  <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {status === 'error' && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{errorMessage}</span></div>
              )}

              {!isAttended && (
                <>
                  {isBooked || isWaitlisted ? (
                    <button onClick={handleCancel} disabled={status === 'loading'} className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform bg-red-500 hover:bg-red-600">
                      {status === 'loading' ? <Loader2 className="animate-spin" /> : (isWaitlisted ? "Leave Waitlist" : "Cancel Booking")}
                    </button>
                  ) : (
                    <>
                      {bookingEligibility && !bookingEligibility.allowed && bookingEligibility.cost > 0 ? (
                        <button onClick={() => goToStore('packs')} className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform bg-green-600 hover:bg-green-700 shadow-md">
                          <ShoppingCart size={18} /> Get Class Credits
                        </button>
                      ) :
                        bookingEligibility && !bookingEligibility.allowed ? (
                          eligiblePublicPlans.length > 0 ? (
                            <button onClick={() => goToStore('memberships')} className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform bg-blue-600 hover:bg-blue-700 shadow-md">
                              <ShoppingCart size={18} /> View All Plans
                            </button>
                          ) : (
                            <button disabled className="w-full py-3 rounded-xl font-bold text-gray-400 bg-gray-100 flex items-center justify-center gap-2 cursor-not-allowed"><Lock size={18} /> Unavailable</button>
                          )
                        ) :
                          (
                            <button onClick={handlePreBookingCheck} disabled={status === 'loading'} className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform" style={{ backgroundColor: isFull ? '#ea580c' : theme.primaryColor }}>
                              {status === 'loading' ? <Loader2 className="animate-spin" /> : (isFull ? "Join Waitlist" : "Confirm Booking")}
                            </button>
                          )}
                    </>
                  )}
                </>
              )}
              <button onClick={onClose} className="w-full py-3 mt-2 text-sm font-semibold text-gray-500 hover:text-gray-800">Close</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingModal;