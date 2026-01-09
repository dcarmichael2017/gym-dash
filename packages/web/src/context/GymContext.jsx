import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
// ✅ ADDED: collection, getDocs
import { doc, getDoc, updateDoc, onSnapshot, collection, getDocs } from 'firebase/firestore'; 
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../../packages/shared/api/firebaseConfig';
import { FullScreenLoader } from '../components/common/FullScreenLoader';

const GymContext = createContext();

export const useGym = () => useContext(GymContext);

export const GymProvider = ({ children }) => {
  const [currentGym, setCurrentGym] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Use a Ref to keep track of currentGymId without triggering effect loops
  const currentGymIdRef = useRef(null);

  const switchGym = async (gymId) => {
    // 1. Guard: Don't switch if we are already there
    if (currentGymIdRef.current === gymId) return;

    try {
      console.log("[GymContext] Switching to gym:", gymId);
      const gymDoc = await getDoc(doc(db, 'gyms', gymId));
      
      if (gymDoc.exists()) {
        const gymData = { id: gymDoc.id, ...gymDoc.data() };

        // --- ✅ START FIX: Fetch Membership Tiers Subcollection ---
        try {
            const tiersRef = collection(db, 'gyms', gymId, 'membershipTiers');
            const tiersSnap = await getDocs(tiersRef);
            
            // Map the subcollection documents into an array
            const tiers = tiersSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Attach it to the gym object so components can access it
            gymData.membershipTiers = tiers;
            console.log("[GymContext] Loaded Tiers:", tiers.length);
        } catch (tierError) {
            console.error("[GymContext] Failed to load tiers:", tierError);
            gymData.membershipTiers = []; // Fallback to empty array to prevent crashes
        }
        // --- ✅ END FIX ---

        currentGymIdRef.current = gymId;
        setCurrentGym(gymData);
        
        // 2. Persist preference (Sticky Session)
        if (auth.currentUser) {
           await updateDoc(doc(db, 'users', auth.currentUser.uid), { 
             lastActiveGymId: gymId 
           }).catch(e => console.error("Pref save failed", e));
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
      
      // Reset state on logout
      if (!user) {
        setCurrentGym(null);
        setMemberships([]);
        currentGymIdRef.current = null;
        if (profileUnsubscribe) profileUnsubscribe();
        setLoading(false);
        return;
      }

      setLoading(true);
      
      profileUnsubscribe = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          let userMemberships = userData.memberships || [];
          
          // Backwards compatibility
          if (userMemberships.length === 0 && userData.gymId) {
             userMemberships = [{ gymId: userData.gymId, gymName: "My Gym", role: userData.role || 'member' }];
          }
          setMemberships(userMemberships);

          // PRIORITY LOGIC
          const lastActiveId = userData.lastActiveGymId;
          const isLastActiveValid = userMemberships.some(m => m.gymId === lastActiveId && !m.isHidden);

          let targetGymId = null;

          if (isLastActiveValid) {
              targetGymId = lastActiveId;
          } else if (userMemberships.length > 0) {
              const firstValid = userMemberships.find(m => !m.isHidden);
              targetGymId = firstValid ? firstValid.gymId : null;
          }

          // ONLY switch if the target is different from what we currently have
          if (targetGymId && targetGymId !== currentGymIdRef.current) {
              await switchGym(targetGymId); 
          } else if (!targetGymId) {
              console.log("[GymContext] No valid gym connection found.");
              setCurrentGym(null);
              currentGymIdRef.current = null;
          }
        }
        setLoading(false);
      }, (error) => {
        console.error("[GymContext] Snapshot error:", error);
        setLoading(false);
      });
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