import { doc, addDoc, collection, updateDoc, getDocs, getDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

// --- CLASS & SCHEDULE MANAGEMENT ---

export const createClass = async (gymId, classData) => {
  try {
    const classCollectionRef = collection(db, "gyms", gymId, "classes");
    const classDocRef = await addDoc(classCollectionRef, {
      ...classData,
      createdAt: new Date(),
    });
    return { success: true, classData: { id: classDocRef.id, ...classData } };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getClasses = async (gymId) => {
  try {
    const classCollectionRef = collection(db, "gyms", gymId, "classes");
    const snapshot = await getDocs(classCollectionRef);
    const classList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, classList };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const deleteClass = async (gymId, classId) => {
  try {
    const classDocRef = doc(db, "gyms", gymId, "classes", classId);
    await deleteDoc(classDocRef);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const updateClass = async (gymId, classId, classData) => {
  try {
    const classRef = doc(db, "gyms", gymId, "classes", classId);
    await updateDoc(classRef, classData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getClassDetails = async (gymId, classId) => {
  try {
    const docRef = doc(db, "gyms", gymId, "classes", classId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    }
    return { success: false, error: "Class not found" };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * GET NEXT UPCOMING CLASS
 */
export const getNextUpcomingClass = async (gymId) => {
  try {
    const classesRef = collection(db, "gyms", gymId, "classes");
    const snapshot = await getDocs(classesRef);
    const classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (classes.length === 0) return { success: true, nextClass: null };

    const now = new Date();
    const currentDayIndex = now.getDay(); 
    const currentTimeValue = now.getHours() * 60 + now.getMinutes();

    const DAYS_MAP = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    let upcomingInstances = [];

    classes.forEach(cls => {
      // HANDLE SIMPLE MODEL
      if (cls.days && Array.isArray(cls.days) && cls.time) {

        const [h, m] = cls.time.split(':').map(Number);
        const classTimeValue = h * 60 + m;

        cls.days.forEach(dayName => {
          const dayIndex = DAYS_MAP.indexOf(dayName.toLowerCase().trim());
          if (dayIndex === -1) return;

          let daysUntil = dayIndex - currentDayIndex;

          if (daysUntil < 0) {
            daysUntil += 7; 
          } else if (daysUntil === 0) {
            if (classTimeValue < currentTimeValue) {
              daysUntil = 7; 
            }
          }

          const targetDate = new Date(now);
          targetDate.setDate(now.getDate() + daysUntil);
          targetDate.setHours(h, m, 0, 0);

          upcomingInstances.push({
            ...cls,
            instanceDate: targetDate,
            startTime: cls.time,
            duration: cls.duration || 60
          });
        });
      }
      // HANDLE COMPLEX MODEL (Legacy/Future)
      else if (cls.schedule && Array.isArray(cls.schedule)) {
        cls.schedule.forEach(slot => {
          if (!slot.active) return;
          const dayIndex = DAYS_MAP.indexOf((slot.day || "").toLowerCase());
          if (dayIndex === -1 || !slot.startTime) return;

          const [h, m] = slot.startTime.split(':').map(Number);
          const slotTime = h * 60 + m;

          let daysUntil = dayIndex - currentDayIndex;
          if (daysUntil < 0) daysUntil += 7;
          else if (daysUntil === 0 && slotTime < currentTimeValue) daysUntil = 7;

          const targetDate = new Date(now);
          targetDate.setDate(now.getDate() + daysUntil);
          targetDate.setHours(h, m, 0, 0);

          upcomingInstances.push({
            ...cls,
            instanceDate: targetDate,
            startTime: slot.startTime,
            duration: slot.duration || 60
          });
        });
      }
    });

    upcomingInstances.sort((a, b) => a.instanceDate - b.instanceDate);

    return { success: true, nextClass: upcomingInstances[0] || null };

  } catch (error) {
    console.error("Error fetching next class:", error);
    return { success: false, error: error.message };
  }
};