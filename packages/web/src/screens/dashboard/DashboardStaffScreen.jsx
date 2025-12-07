import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { 
  Plus, 
  Trash2, 
  Edit2, // New Icon
  Shield, 
  User, 
  X, 
  Mail, 
  Phone,
  Tag,
  Camera
} from 'lucide-react';

import { auth, db } from '../../../../shared/api/firebaseConfig';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { 
  getStaffList, 
  addStaffMember, 
  deleteStaffMember, 
  updateStaffMember,
  checkStaffDependencies
} from '../../../../shared/api/firestore';
import { FullScreenLoader } from '../../components/layout/FullScreenLoader';
import { uploadStaffPhoto } from '../../../../shared/api/storage';

const DashboardStaffScreen = () => {
  const [loading, setLoading] = useState(true);
  const [gymId, setGymId] = useState(null);
  const [staffList, setStaffList] = useState([]);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentStaffId, setCurrentStaffId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State (Expanded)
  const [formData, setFormData] = useState({
    name: '', title: '', email: '', phone: '', bio: '', specialties: '', photoUrl: null 
  });
  const [photoFile, setPhotoFile] = useState(null);

  useEffect(() => {
    const initData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists() && userSnap.data().gymId) {
          const gId = userSnap.data().gymId;
          setGymId(gId);
          const result = await getStaffList(gId);
          if (result.success) setStaffList(result.staffList);
        }
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    initData();
  }, []);

  // --- Handlers ---

  const openAddModal = () => {
    setFormData({ name: '', title: '', email: '', phone: '', bio: '', specialties: '', photoUrl: null });
    setPhotoFile(null);
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const openEditModal = (staff) => {
    setFormData({
      name: staff.name || '',
      title: staff.title || '',
      email: staff.email || '',
      phone: staff.phone || '',
      bio: staff.bio || '',
      specialties: staff.specialties ? staff.specialties.join(', ') : '',
      photoUrl: staff.photoUrl || null
    });
    setPhotoFile(null);
    setCurrentStaffId(staff.id);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    staffId: null,
    title: '',
    message: '',
    isLoading: false
  });

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setPhotoFile(e.target.files[0]);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name) return;
    setIsSaving(true);

    let finalPhotoUrl = formData.photoUrl;

    // 1. Handle Image Upload if a new file exists
    if (photoFile) {
        const uploadResult = await uploadStaffPhoto(gymId, photoFile);
        if (uploadResult.success) {
            finalPhotoUrl = uploadResult.url;
        } else {
            alert("Failed to upload image, but saving text data.");
        }
    }

    // 2. Prepare Payload
    const cleanData = {
      ...formData,
      photoUrl: finalPhotoUrl,
      specialties: formData.specialties.split(',').map(s => s.trim()).filter(s => s !== '')
    };

    if (isEditMode) {
      // UPDATE
      const result = await updateStaffMember(gymId, currentStaffId, cleanData);
      if (result.success) {
        setStaffList(prev => prev.map(s => s.id === currentStaffId ? { ...s, ...cleanData } : s));
        setIsModalOpen(false);
      }
    } else {
      // ADD
      const result = await addStaffMember(gymId, cleanData);
      if (result.success) {
        setStaffList([...staffList, result.staffMember]);
        setIsModalOpen(false);
      }
    }
    setIsSaving(false);
  };

  const handleDeleteClick = async (staffId) => {
    // 1. Check Dependencies (Classes taught by this instructor)
    // We do this BEFORE showing the modal so we know which message to show
    const depResult = await checkStaffDependencies(gymId, staffId);
    
    let title = "Remove Staff Member";
    let message = "Are you sure you want to remove this staff member? This action cannot be undone.";
    
    if (depResult.success && depResult.count > 0) {
        title = "Warning: Instructor Assigned";
        message = `This instructor is currently assigned to ${depResult.count} classes.\n\nDeleting them will remove them from these classes, leaving the classes unassigned.\n\nAre you sure you want to proceed?`;
    }

    setDeleteModal({
        isOpen: true,
        staffId: staffId,
        title: title,
        message: message,
        isLoading: false
    });
  };

  const executeDelete = async () => {
    const { staffId } = deleteModal;
    if (!staffId) return;

    setDeleteModal(prev => ({ ...prev, isLoading: true }));

    // Perform API Delete
    const result = await deleteStaffMember(gymId, staffId);

    if (result.success) {
        // UI Update
        setStaffList(prev => prev.filter(s => s.id !== staffId));
        setDeleteModal({ isOpen: false, staffId: null, title: '', message: '', isLoading: false });
    } else {
        alert("Failed to delete staff member."); // Fallback for API error
        setDeleteModal(prev => ({ ...prev, isLoading: false }));
    }
  };

  if (loading) return <FullScreenLoader />;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header (Same as before) */}
      <div className="flex justify-between items-center mb-8">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">Staff Management</h2>
            <p className="text-gray-500">Manage instructors, coaches, and admin.</p>
        </div>
        <button onClick={openAddModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 transition-colors">
          <Plus className="h-5 w-5 mr-2" /> Add Staff
        </button>
      </div>

      {/* --- STAFF GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staffList.map(staff => (
            <div key={staff.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-all">
                <div className="p-6 flex-1">
                    <div className="flex justify-between items-start mb-4">
                        {/* --- AVATAR DISPLAY --- */}
                        <div className="h-16 w-16 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                            {staff.photoUrl ? (
                                <img src={staff.photoUrl} alt={staff.name} className="h-full w-full object-cover" />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center bg-blue-50 text-blue-600 font-bold text-xl">
                                    {staff.name[0]}
                                </div>
                            )}
                        </div>
                        {/* Tags */}
                        <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                           {staff.specialties && staff.specialties.slice(0, 3).map((tag, i) => (
                             <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full uppercase tracking-wide">
                               {tag}
                             </span>
                           ))}
                        </div>
                    </div>
                    
                    <h3 className="font-bold text-gray-800 text-lg">{staff.name}</h3>
                    <p className="text-blue-600 text-sm font-medium mb-3 flex items-center">
                        <Shield className="h-3 w-3 mr-1" /> {staff.title}
                    </p>
                    {/* ... Bio/Email/Phone display remains the same ... */}
                    {staff.bio && <p className="text-gray-500 text-sm line-clamp-2 mb-4">{staff.bio}</p>}
                    <div className="space-y-1 text-sm text-gray-500">
                        {staff.email && <div className="flex items-center"><Mail className="h-3 w-3 mr-2" /> {staff.email}</div>}
                    </div>
                </div>
                {/* ... Footer Actions remain the same ... */}
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-end gap-3">
                    <button onClick={() => openEditModal(staff)} className="text-gray-600 hover:text-blue-600 text-sm font-medium flex items-center">
                        <Edit2 className="h-4 w-4 mr-1" /> Edit
                    </button>
                    <button 
                        onClick={() => handleDeleteClick(staff.id)} // Call new handler
                        className="text-gray-400 hover:text-red-600 text-sm font-medium flex items-center transition-colors"
                    >
                        <Trash2 className="h-4 w-4 mr-1" /> Remove
                    </button>
                </div>
            </div>
        ))}
        {staffList.length === 0 && (
            <div className="col-span-full py-16 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <User className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No staff members found.</p>
                <button onClick={openAddModal} className="text-blue-600 text-sm hover:underline mt-1">Add your first team member</button>
            </div>
        )}
      </div>

      <ConfirmationModal 
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={executeDelete}
        title={deleteModal.title}
        message={deleteModal.message}
        isLoading={deleteModal.isLoading}
        confirmText="Remove Member"
        isDestructive={true}
      />

      {/* --- EDIT/ADD MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-800">
                        {isEditMode ? 'Edit Staff Member' : 'Add New Staff'}
                    </h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                
                <form onSubmit={handleSave} className="p-6 space-y-5">
                    
                    {/* --- PHOTO UPLOAD SECTION --- */}
                    <div className="flex flex-col items-center justify-center mb-6">
                        <div className="relative group cursor-pointer">
                            <div className="h-24 w-24 rounded-full bg-gray-100 overflow-hidden border-2 border-gray-200 flex items-center justify-center">
                                {photoFile ? (
                                    <img src={URL.createObjectURL(photoFile)} className="h-full w-full object-cover" />
                                ) : formData.photoUrl ? (
                                    <img src={formData.photoUrl} className="h-full w-full object-cover" />
                                ) : (
                                    <User className="h-10 w-10 text-gray-400" />
                                )}
                            </div>
                            <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white">
                                <Camera className="h-6 w-6" />
                                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                            </label>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Click to upload photo</p>
                    </div>

                    {/* Standard Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Full Name *</label>
                            <input 
                                required
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Title / Role *</label>
                            <input 
                                required
                                value={formData.title}
                                onChange={e => setFormData({...formData, title: e.target.value})}
                                placeholder="e.g. Coach"
                                className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Email</label>
                            <input 
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                                className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Phone</label>
                            <input 
                                type="tel"
                                value={formData.phone}
                                onChange={e => setFormData({...formData, phone: e.target.value})}
                                className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Bio</label>
                        <textarea 
                            rows="3"
                            value={formData.bio}
                            onChange={e => setFormData({...formData, bio: e.target.value})}
                            placeholder="Tell members about this instructor..."
                            className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Specialties</label>
                        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                            <div className="pl-3 text-gray-400"><Tag className="h-4 w-4" /></div>
                            <input 
                                value={formData.specialties}
                                onChange={e => setFormData({...formData, specialties: e.target.value})}
                                placeholder="BJJ, Wrestling, Kids (comma separated)"
                                className="w-full p-2.5 outline-none border-none"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                            disabled={isSaving}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 flex items-center"
                            disabled={isSaving}
                        >
                            {isSaving ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Create Staff')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default DashboardStaffScreen;