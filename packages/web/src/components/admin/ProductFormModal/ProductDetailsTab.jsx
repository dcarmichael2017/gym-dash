import React from 'react';
import {
  DollarSign, Tag, Globe, Users, Lock, Eye, EyeOff, Star
} from 'lucide-react';

export const ProductDetailsTab = ({ formData, updateFormData, categories, primaryColor }) => {

  const VisibilityOption = ({ value, label, icon: Icon, desc }) => (
    <button
      type="button"
      onClick={() => updateFormData({ visibility: value })}
      className={`flex-1 p-3 rounded-xl border text-left transition-all ${
        formData.visibility === value ? 'ring-1' : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
      style={formData.visibility === value ? {
        backgroundColor: `${primaryColor}10`,
        borderColor: primaryColor,
        ringColor: primaryColor
      } : {}}
    >
      <div className="mb-1" style={{ color: formData.visibility === value ? primaryColor : '#9ca3af' }}>
        <Icon size={20} />
      </div>
      <div className="text-xs font-bold uppercase" style={{ color: formData.visibility === value ? primaryColor : '#4b5563' }}>
        {label}
      </div>
      <div className="text-[10px] text-gray-400 mt-0.5">{desc}</div>
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Product Name */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">
          Product Name <span className="text-red-500">*</span>
        </label>
        <input
          required
          placeholder="e.g. Team Rashguard"
          value={formData.name}
          onChange={e => updateFormData({ name: e.target.value })}
          className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': primaryColor }}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">
          Description
        </label>
        <textarea
          placeholder="Describe your product..."
          value={formData.description}
          onChange={e => updateFormData({ description: e.target.value })}
          rows={3}
          className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:border-transparent resize-none"
          style={{ '--tw-ring-color': primaryColor }}
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">
          Category
        </label>
        <div className="relative">
          <Tag className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <select
            value={formData.category}
            onChange={e => updateFormData({ category: e.target.value })}
            className="w-full pl-10 p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:border-transparent bg-white appearance-none cursor-pointer"
            style={{ '--tw-ring-color': primaryColor }}
          >
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <div className="absolute right-3 top-3 pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Price Row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">
            Price <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              required
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formData.price}
              onChange={e => updateFormData({ price: e.target.value })}
              className="w-full pl-10 p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': primaryColor }}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">
            Compare at Price
            <span className="text-gray-400 normal-case ml-1">(optional)</span>
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Original price for sales"
              value={formData.compareAtPrice}
              onChange={e => updateFormData({ compareAtPrice: e.target.value })}
              className="w-full pl-10 p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': primaryColor }}
            />
          </div>
          {formData.compareAtPrice && parseFloat(formData.compareAtPrice) > parseFloat(formData.price || 0) && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <Tag size={12} /> Will show as "on sale"
            </p>
          )}
        </div>
      </div>

      {/* Visibility */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase">
          Visibility
        </label>
        <div className="flex gap-2">
          <VisibilityOption value="public" label="Public" icon={Globe} desc="Visible in member store" />
          <VisibilityOption value="internal" label="Internal" icon={Users} desc="Staff purchase only" />
          <VisibilityOption value="hidden" label="Hidden" icon={Lock} desc="Draft / Not visible" />
        </div>
      </div>

      {/* Status Toggles */}
      <div className="space-y-3">
        {/* Active Toggle */}
        <div
          className="p-4 rounded-xl border transition-all"
          style={formData.active
            ? { backgroundColor: `${primaryColor}10`, borderColor: `${primaryColor}30` }
            : { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }
          }
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              {formData.active ? (
                <Eye className="h-5 w-5" style={{ color: primaryColor }} />
              ) : (
                <EyeOff className="h-5 w-5 text-gray-400" />
              )}
              <div>
                <p className="text-sm font-bold" style={{ color: formData.active ? primaryColor : '#4b5563' }}>
                  Active Product
                </p>
                <p className="text-xs text-gray-500">
                  {formData.active ? 'Product is available for purchase' : 'Product is disabled'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateFormData({ active: !formData.active })}
              className="w-11 h-6 rounded-full relative transition-colors"
              style={{ backgroundColor: formData.active ? primaryColor : '#d1d5db' }}
            >
              <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                formData.active ? 'translate-x-5' : ''
              }`} />
            </button>
          </div>
        </div>

        {/* Featured Toggle */}
        <div
          className="p-4 rounded-xl border transition-all"
          style={formData.featured
            ? { backgroundColor: '#fef9c3', borderColor: '#fcd34d' }
            : { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }
          }
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Star className={`h-5 w-5 ${formData.featured ? 'text-yellow-600 fill-yellow-500' : 'text-gray-400'}`} />
              <div>
                <p className={`text-sm font-bold ${formData.featured ? 'text-yellow-800' : 'text-gray-700'}`}>
                  Featured Product
                </p>
                <p className="text-xs text-gray-500">
                  {formData.featured ? 'Shown in featured section' : 'Normal product listing'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateFormData({ featured: !formData.featured })}
              className="w-11 h-6 rounded-full relative transition-colors"
              style={{ backgroundColor: formData.featured ? '#eab308' : '#d1d5db' }}
            >
              <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                formData.featured ? 'translate-x-5' : ''
              }`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailsTab;
