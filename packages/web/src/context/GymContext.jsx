import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore'; 
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../../packages/shared/api/firebaseConfig';
import { FullScreenLoader } from '../components/common/FullScreenLoader';

const GymContext = createContext();

export const useGym = () => useContext(GymContext);

export const GymProvider = ({ children }) => {
  const [currentGym, setCurrentGym] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper to switch context
  const switchGym = async (gymId) => {
    try {
      console.log("[GymContext] Switching to gym:", gymId);
      const gymDoc = await getDoc(doc(db, 'gyms', gymId));
      if (gymDoc.exists()) {
        setCurrentGym({ id: gymDoc.id, ...gymDoc.data() });
        // Save preference
        if (auth.currentUser) {
           updateDoc(doc(db, 'users', auth.currentUser.uid), { lastActiveGymId: gymId })
             .catch(e => console.error("Pref save failed", e));
        }
      }
    } catch (error) {
      console.error("[GymContext] Failed to switch gym:", error);
    }
  };

  useEffect(() => {
    let profileUnsubscribe = null;

    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("[GymContext] Auth Changed. User:", user ? user.uid : "null");
      
      // 1. CRITICAL: WIPE STATE ON USER CHANGE
      setCurrentGym(null);
      setMemberships([]);
      
      if (profileUnsubscribe) {
        console.log("[GymContext] Unsubscribing from old profile");
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      if (user) {
        setLoading(true);
        console.log("[GymContext] Subscribing to new profile...");
        
        // 2. USE REAL-TIME LISTENER (onSnapshot)
        profileUnsubscribe = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
           if (docSnap.exists()) {
              console.log("[GymContext] Profile Update Received");
              const userData = docSnap.data();
              let userMemberships = userData.memberships || [];
              
              // Backwards compatibility
              if (userMemberships.length === 0 && userData.gymId) {
                 userMemberships = [{ gymId: userData.gymId, gymName: "My Gym", role: userData.role || 'member' }];
              }
              setMemberships(userMemberships);

              const targetGymId = userData.lastActiveGymId || userMemberships[0]?.gymId;

              if (targetGymId) {
                  // Only fetch gym details if we have a target
                  await switchGym(targetGymId); 
              } else {
                  console.log("[GymContext] No target gym found. Staying at Zero State.");
                  setCurrentGym(null);
              }
           } else {
               console.log("[GymContext] Profile doc does not exist yet...");
           }
           setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  if (loading) return <FullScreenLoader />;

  return (
    <GymContext.Provider value={{ currentGym, memberships, switchGym, isLoading: loading }}>
      {children}
    </GymContext.Provider>
  );
};