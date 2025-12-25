import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../../../packages/shared/api/firebaseConfig';
import { FullScreenLoader } from '../components/common/FullScreenLoader';

const GymContext = createContext();

export const useGym = () => useContext(GymContext);

export const GymProvider = ({ children }) => {
  const [currentGym, setCurrentGym] = useState(null); // The full gym object (branding, settings)
  const [memberships, setMemberships] = useState([]); // List of all gyms they can switch to
  const [loading, setLoading] = useState(true);

  // Helper to switch context
  const switchGym = async (gymId) => {
    setLoading(true);
    try {
      // 1. Fetch Gym Details (Theme, Name, etc.)
      const gymDoc = await getDoc(doc(db, 'gyms', gymId));
      if (gymDoc.exists()) {
        setCurrentGym({ id: gymDoc.id, ...gymDoc.data() });
        
        // 2. Persist this choice so next refresh remembers
        if (auth.currentUser) {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            lastActiveGymId: gymId
          });
        }
      }
    } catch (error) {
      console.error("Failed to switch gym:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initGym = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // HANDLE BACKWARDS COMPATIBILITY
          // If they have the old 'gymId' field but no memberships array yet
          let userMemberships = userData.memberships || [];
          
          if (userMemberships.length === 0 && userData.gymId) {
             // Create a temporary membership entry for their existing gym
             userMemberships = [{ 
               gymId: userData.gymId, 
               gymName: "My Gym", // We'd ideally fetch this name
               role: userData.role || 'member' 
             }];
          }

          setMemberships(userMemberships);

          // DECIDE WHICH GYM TO LOAD
          const targetGymId = userData.lastActiveGymId || userMemberships[0]?.gymId;

          if (targetGymId) {
            await switchGym(targetGymId);
          } else {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("Error initializing gym context:", error);
        setLoading(false);
      }
    };

    initGym();
  }, []);

  if (loading) return <FullScreenLoader />;

  return (
    <GymContext.Provider value={{ currentGym, memberships, switchGym, isLoading: loading }}>
      {children}
    </GymContext.Provider>
  );
};