import React, { useState, useRef } from 'react';
import {
  Upload, X, Image as ImageIcon, Loader2, Star, GripVertical, AlertCircle
} from 'lucide-react';
import { uploadProductImage, deleteStorageFile } from '../../../../../../packages/shared/api/storage';

export const ProductImagesTab = ({ formData, updateFormData, gymId, productId, primaryColor }) => {
  const [uploading, setUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check max images limit
    if (formData.images.length + files.length > 5) {
      alert('Maximum 5 images allowed per product');
      return;
    }

    setUploading(true);

    const newImages = [];
    for (const file of files) {
      const result = await uploadProductImage(gymId, productId || 'new', file);
      if (result.success) {
        newImages.push(result.url);
      } else {
        alert(`Failed to upload ${file.name}: ${result.error}`);
      }
    }

    if (newImages.length > 0) {
      updateFormData({ images: [...formData.images, ...newImages] });
    }

    setUploading(false);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = async (index) => {
    const imageUrl = formData.images[index];
    const newImages = formData.images.filter((_, i) => i !== index);
    updateFormData({ images: newImages });

    // Try to delete from storage (don't wait or block)
    deleteStorageFile(imageUrl).catch(err => {
      console.warn('Could not delete image from storage:', err);
    });
  };

  const handleSetPrimary = (index) => {
    if (index === 0) return; // Already primary

    const newImages = [...formData.images];
    const [movedImage] = newImages.splice(index, 1);
    newImages.unshift(movedImage);
    updateFormData({ images: newImages });
  };

  // Drag and drop handlers
  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newImages = [...formData.images];
      const [movedImage] = newImages.splice(draggedIndex, 1);
      newImages.splice(dragOverIndex, 0, movedImage);
      updateFormData({ images: newImages });
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          uploading ? 'border-gray-300 bg-gray-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onClick={() => !uploading && fileInputRef.current?.click()}
        style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />

        {uploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="h-12 w-12 animate-spin text-gray-400 mb-3" />
            <p className="text-gray-500 font-medium">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-700 font-medium mb-1">Click to upload images</p>
            <p className="text-xs text-gray-500">
              JPEG, PNG, or WebP • Max 5MB each • Up to 5 images
            </p>
          </div>
        )}
      </div>

      {/* Images Preview */}
      {formData.images.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-500 uppercase">
              Product Images
            </label>
            <span className="text-xs text-gray-400">
              {formData.images.length}/5 • Drag to reorder
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {formData.images.map((url, index) => (
              <div
                key={url}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onDragLeave={handleDragLeave}
                className={`relative group rounded-xl overflow-hidden border-2 transition-all ${
                  dragOverIndex === index
                    ? 'border-blue-400 scale-105'
                    : index === 0
                      ? 'border-yellow-400'
                      : 'border-gray-200'
                } ${draggedIndex === index ? 'opacity-50' : ''}`}
                style={dragOverIndex === index ? { borderColor: primaryColor } : {}}
              >
                {/* Image */}
                <div className="aspect-square bg-gray-100">
                  <img
                    src={url}
                    alt={`Product ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Primary Badge */}
                {index === 0 && (
                  <div className="absolute top-2 left-2 px-2 py-1 bg-yellow-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                    <Star size={10} className="fill-white" /> Primary
                  </div>
                )}

                {/* Drag Handle */}
                <div className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                  <GripVertical size={14} className="text-white" />
                </div>

                {/* Actions Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {index !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(index)}
                      className="p-2 bg-white rounded-lg text-yellow-600 hover:bg-yellow-50 transition-colors"
                      title="Set as primary"
                    >
                      <Star size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="p-2 bg-white rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                    title="Remove image"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}

            {/* Add More Placeholder */}
            {formData.images.length < 5 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="aspect-square border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
              >
                <ImageIcon size={24} className="mb-2" />
                <span className="text-xs font-medium">Add Image</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {formData.images.length === 0 && !uploading && (
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <ImageIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No images uploaded yet</p>
          <p className="text-gray-400 text-xs mt-1">
            Products with images are more likely to sell
          </p>
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-1">Image Tips:</p>
            <ul className="text-xs text-blue-600 space-y-1 list-disc list-inside">
              <li>The first image will be shown as the main product image</li>
              <li>Use square images (1:1 ratio) for best display</li>
              <li>Drag images to reorder or click the star to set primary</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductImagesTab;
