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
  const [credits, setCredits] = useState(0); // ✅ NEW: Current gym credits
  const [loading, setLoading] = useState(true);

  // Use a Ref to keep track of currentGymId without triggering effect loops
  const currentGymIdRef = useRef(null);

  const switchGym = async (gymId) => {
    // If gymId is null, explicitly clear the current gym
    if (!gymId) {
      console.log("[GymContext] Clearing current gym.");
      setCurrentGym(null);
      currentGymIdRef.current = null;
      return;
    }

    // 1. Guard: Don't switch if we are already there
    if (currentGymIdRef.current === gymId) return;

    try {
      console.log("[GymContext] Attempting to switch to gym:", gymId);
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
      } else {
        // If gym document doesn't exist, clear the current gym
        console.log(`[GymContext] Gym document for ID ${gymId} not found. Clearing current gym.`);
        setCurrentGym(null);
        currentGymIdRef.current = null;
      }
    } catch (error) {
      console.error("[GymContext] Failed to switch gym:", error);
      setCurrentGym(null); // Ensure currentGym is null on error
      currentGymIdRef.current = null;
    }
  };

  // ✅ NEW: Separate effect for listening to credits
  useEffect(() => {
    let creditsUnsubscribe = null;

    if (currentGym?.id && auth.currentUser) {
      const creditRef = doc(db, 'users', auth.currentUser.uid, 'credits', currentGym.id);
      creditsUnsubscribe = onSnapshot(creditRef, (snap) => {
        if (snap.exists()) {
          setCredits(snap.data().balance || 0);
        } else {
          setCredits(0);
        }
      }, (error) => {
        console.error("[GymContext] Credits snapshot error:", error);
        setCredits(0);
      });
    } else {
      setCredits(0); // Reset credits when no gym is selected
    }

    return () => {
      if (creditsUnsubscribe) creditsUnsubscribe();
    };
  }, [currentGym?.id]);

  useEffect(() => {
    let profileUnsubscribe = null;
    let membershipsUnsubscribe = null;

    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("[GymContext] Auth Changed. User:", user ? user.uid : "null");
      
      // Reset state on logout
      if (!user) {
        setCurrentGym(null);
        setMemberships([]);
        currentGymIdRef.current = null;
        if (profileUnsubscribe) profileUnsubscribe();
        if (membershipsUnsubscribe) membershipsUnsubscribe();
        setLoading(false);
        return;
      }

      setLoading(true);

      // Listen to the user's top-level document for general info like lastActiveGymId
      profileUnsubscribe = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
          if (!docSnap.exists()) {
              console.log("[GymContext] User profile does not exist after auth. Clearing gym info.");
              setMemberships([]);
              setCurrentGym(null);
              currentGymIdRef.current = null;
              setLoading(false);
              return;
          }
          const userData = docSnap.data();
          const lastActiveId = userData.lastActiveGymId;

          // Set up a listener for the memberships subcollection
          if (membershipsUnsubscribe) membershipsUnsubscribe(); // Clean up previous listener if any

          membershipsUnsubscribe = onSnapshot(collection(db, 'users', user.uid, 'memberships'), async (snapshot) => {
              const userMemberships = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              setMemberships(userMemberships);

              const isLastActiveValid = userMemberships.some(m => m.gymId === lastActiveId && !m.isHidden);
              let targetGymId = null;

              if (isLastActiveValid) {
                  targetGymId = lastActiveId;
              } else if (userMemberships.length > 0) {
                  const firstValid = userMemberships.find(m => !m.isHidden);
                  targetGymId = firstValid ? firstValid.gymId : null;
              }

              // ONLY switch if the target is different from what we currently have
              // or if currentGym is null and targetGymId is NOT null (meaning we found a gym)
              if (targetGymId && targetGymId !== currentGymIdRef.current) {
                  await switchGym(targetGymId);
              } else if (!targetGymId && currentGymIdRef.current !== null) { // If no target gym, clear current gym if one was set
                  console.log("[GymContext] No valid gym connection found. Clearing current gym.");
                  setCurrentGym(null);
                  currentGymIdRef.current = null;
              } else if (!targetGymId && currentGymIdRef.current === null) {
                  console.log("[GymContext] No valid gym connection found. (Already null)");
                  // This is the case for new users, currentGym is already null, so no action needed.
              }
              setLoading(false);
          }, (error) => {
              console.error("[GymContext] Memberships subcollection snapshot error:", error);
              setLoading(false);
          });
      }, (error) => {
          console.error("[GymContext] User profile snapshot error:", error);
          setLoading(false);
      });
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
      if (membershipsUnsubscribe) membershipsUnsubscribe();
    };
  }, []);

  if (loading) return <FullScreenLoader />;

  return (
    <GymContext.Provider value={{ currentGym, memberships, credits, switchGym, isLoading: loading }}>
      {children}
    </GymContext.Provider>
  );
};
