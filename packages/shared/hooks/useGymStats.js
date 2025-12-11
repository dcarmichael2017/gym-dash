import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../api/firebaseConfig';
import { getGymMembers } from '../api/firestore';

export const useGymStats = (gymId) => {
  const getCacheKey = (id) => `gymDash_stats_${id}`;

  const [stats, setStats] = useState(() => {
    if (!gymId) return {
        activeMembers: 0, trialingMembers: 0, mrrEstimate: 0, totalStaff: 0,
        demographics: { adults: 0, dependents: 0, avgAge: 0 },
        signupHistory: [], tierDistribution: [], loading: true
    };
    const cachedData = sessionStorage.getItem(getCacheKey(gymId));
    return cachedData ? { ...JSON.parse(cachedData), loading: false } : {
        activeMembers: 0, trialingMembers: 0, mrrEstimate: 0, totalStaff: 0,
        demographics: { adults: 0, dependents: 0, avgAge: 0 },
        signupHistory: [], tierDistribution: [], loading: true
    };
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!gymId) return;

      try {
        const tiersRef = collection(db, 'gyms', gymId, 'membershipTiers');
        const tiersSnap = await getDocs(tiersRef);
        const tierMap = {}; 
        tiersSnap.docs.forEach(doc => {
          const data = doc.data();
          tierMap[doc.id] = {
            price: Number(data.price) || 0,
            interval: data.interval || 'month'
          };
        });

        const result = await getGymMembers(gymId);
        const membersList = result.success ? result.members : [];
        
        let active = 0;
        let trialing = 0;
        let mrr = 0;
        let adults = 0;
        let dependents = 0;
        let totalAge = 0;
        let ageCount = 0;
        const historyMap = {};
        const tierCounts = {}; // <--- New: Count Plans

        membersList.forEach(m => {
          const rawStatus = m.subscriptionStatus || m.status || 'inactive';
          const status = rawStatus.toString().toLowerCase(); 

          if (status === 'active') {
            active++;
            
            // MRR Calc
            if (m.assignedPrice !== undefined && m.assignedPrice !== null && m.assignedPrice !== '') {
                mrr += Number(m.assignedPrice);
            } else if (m.membershipId && tierMap[m.membershipId]) {
              const tier = tierMap[m.membershipId];
              let monthlyValue = 0;
              if (tier.interval === 'year' || tier.interval === 'yearly') monthlyValue = tier.price / 12;
              else if (tier.interval === 'month' || tier.interval === 'monthly') monthlyValue = tier.price;
              else if (tier.interval === 'week' || tier.interval === 'weekly') monthlyValue = tier.price * 4.33; 
              mrr += monthlyValue;
            }

            // Plan Distribution Calc
            // We use the name stored on the member, or 'Unknown'
            const planName = m.membershipName || 'Unknown Plan';
            tierCounts[planName] = (tierCounts[planName] || 0) + 1;
          } 
          else if (status === 'trialing') {
            trialing++;
          }

          // Demographics
          if (m.isDependent || m.payerId) dependents++; else adults++;

          // Age (Strict Check: Must have DOB)
          if (m.dob) {
            const dobDate = new Date(m.dob);
            const ageDifMs = Date.now() - dobDate.getTime();
            const ageDate = new Date(ageDifMs); 
            const age = Math.abs(ageDate.getUTCFullYear() - 1970);
            if (age > 0 && age < 110) {
                totalAge += age;
                ageCount++;
            }
          }

          // History
          if (m.createdAt) {
            const dateObj = m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
            if (!isNaN(dateObj)) {
                const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
                historyMap[key] = (historyMap[key] || 0) + 1;
            }
          }
        });

        // Format History
        const historyArray = Object.keys(historyMap).sort().map(key => {
            const [year, month] = key.split('-');
            const dateObj = new Date(year, month - 1);
            return {
                date: key,
                name: dateObj.toLocaleString('default', { month: 'short', year: 'numeric' }),
                signups: historyMap[key]
            };
        });

        // Format Tiers for Recharts
        const tierDistribution = Object.keys(tierCounts).map(name => ({
            name: name,
            value: tierCounts[name]
        }));

        const staffRef = collection(db, 'gyms', gymId, 'staff');
        const staffSnap = await getDocs(staffRef);

        const finalStats = {
          activeMembers: active,
          trialingMembers: trialing,
          mrrEstimate: mrr,
          totalStaff: staffSnap.size,
          demographics: {
            adults,
            dependents,
            avgAge: ageCount > 0 ? Math.round(totalAge / ageCount) : 0
          },
          signupHistory: historyArray,
          tierDistribution, // <--- Exposed
          loading: false 
        };

        setStats(finalStats);
        sessionStorage.setItem(getCacheKey(gymId), JSON.stringify(finalStats));

      } catch (error) {
        console.error("Error calculating gym stats:", error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
  }, [gymId]);

  return stats;
};