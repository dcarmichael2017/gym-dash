import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { updateGymDetails } from '../../../../../shared/api/firestore';

export const GeneralSettingsTab = ({ gymId, initialData, showMessage }) => {
  const [data, setData] = useState(initialData);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const result = await updateGymDetails(gymId, data);
    if (result.success) showMessage('success', 'Gym details updated!');
    else showMessage('error', 'Failed to update details.');
    setSaving(false);
  };

  return (
    <form onSubmit={handleSave}>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gym Name</label>
          <input 
            type="text" 
            value={data.name}
            onChange={e => setData({...data, name: e.target.value})}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea 
            rows="4"
            value={data.description}
            onChange={e => setData({...data, description: e.target.value})}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex justify-end pt-4">
          <button 
            type="submit" 
            disabled={saving}
            className="flex items-center bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </form>
  );
};