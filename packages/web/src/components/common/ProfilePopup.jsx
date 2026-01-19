import React, { useState, useRef, useEffect } from 'react';
import { User } from 'lucide-react';

/**
 * ProfilePopup - A clickable name that shows a popup with user info
 *
 * For members: Shows a simple popup with the user's full name
 * For admins: Shows popup AND can trigger opening the member modal
 *
 * @param {string} name - Display name of the user
 * @param {string} senderId - User ID of the sender
 * @param {string} senderRole - Role of the sender (owner/staff/coach/member)
 * @param {boolean} isAdmin - Whether the current viewer is an admin
 * @param {function} onAdminClick - Callback when admin clicks to view full profile (receives senderId)
 * @param {string} className - Additional classes for the name text
 */
export const ProfilePopup = ({
  name,
  senderId,
  senderRole,
  isAdmin = false,
  onAdminClick,
  className = ''
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const popupRef = useRef(null);

  const isSenderAdmin = ['owner', 'staff', 'coach'].includes(senderRole);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setShowPopup(false);
      }
    };

    if (showPopup) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPopup]);

  const handleClick = (e) => {
    e.stopPropagation();

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopupPosition({
        top: rect.bottom + 8,
        left: rect.left
      });
    }

    setShowPopup(!showPopup);
  };

  const handleViewProfile = () => {
    setShowPopup(false);
    if (onAdminClick && senderId) {
      onAdminClick(senderId);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleClick}
        className={`font-bold text-xs text-gray-800 hover:text-blue-600 hover:underline cursor-pointer transition-colors ${className}`}
      >
        {name}
      </button>

      {showPopup && (
        <div
          ref={popupRef}
          className="fixed z-[100] bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px] animate-in fade-in zoom-in-95 duration-150"
          style={{
            top: `${popupPosition.top}px`,
            left: `${popupPosition.left}px`,
          }}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
              isSenderAdmin ? 'bg-blue-600' : 'bg-gray-400'
            }`}>
              <User size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 truncate">{name}</p>
              <p className="text-xs text-gray-500 capitalize">
                {isSenderAdmin ? (senderRole === 'owner' ? 'Owner' : senderRole === 'coach' ? 'Coach' : 'Staff') : 'Member'}
              </p>
            </div>
          </div>

          {/* Admin can view full member profile */}
          {isAdmin && !isSenderAdmin && onAdminClick && (
            <button
              onClick={handleViewProfile}
              className="mt-3 w-full px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              View Full Profile
            </button>
          )}
        </div>
      )}
    </>
  );
};

export default ProfilePopup;
