import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Crop, RotateCw, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { getCroppedImg, blobToFile, getAspectRatio } from '@shared/api/imageUtils';

/**
 * Image cropping modal with aspect ratio controls
 * @param {object} props
 * @param {File} props.image - The image file to crop
 * @param {function} props.onCropComplete - Callback with the cropped file
 * @param {function} props.onCancel - Cancel callback
 * @param {string} props.defaultAspect - Default aspect ratio ('1:1', '4:3')
 * @param {boolean} props.allowAspectChange - Allow user to change aspect ratio
 * @param {string} props.primaryColor - Theme primary color
 */
const ImageCropModal = ({
  image,
  onCropComplete,
  onCancel,
  defaultAspect = '4:3',
  allowAspectChange = true,
  primaryColor = '#2563eb'
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [aspectRatio, setAspectRatio] = useState(defaultAspect);
  const [loading, setLoading] = useState(false);
  const [imageUrl] = useState(() => URL.createObjectURL(image));

  const onCropChange = useCallback((newCrop) => {
    setCrop(newCrop);
  }, []);

  const onZoomChange = useCallback((newZoom) => {
    setZoom(newZoom);
  }, []);

  const handleCropComplete = useCallback((croppedArea, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleAspectChange = (ratio) => {
    setAspectRatio(ratio);
    // Reset crop position when aspect changes
    setCrop({ x: 0, y: 0 });
  };

  const handleSave = async () => {
    if (!croppedAreaPixels) return;

    setLoading(true);
    try {
      const { blob, width, height } = await getCroppedImg(
        imageUrl,
        croppedAreaPixels,
        rotation,
        {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.85,
          format: 'image/jpeg'
        }
      );

      // Generate a new filename
      const originalName = image.name.split('.')[0];
      const newFile = blobToFile(blob, `${originalName}_cropped.jpg`);

      onCropComplete(newFile, { width, height });
    } catch (error) {
      console.error('Error cropping image:', error);
      alert('Error processing image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    URL.revokeObjectURL(imageUrl);
    onCancel();
  };

  const aspectOptions = [
    { value: '1:1', label: '1:1' },
    { value: '4:3', label: '4:3' },
    { value: '16:9', label: '16:9' }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Crop size={20} style={{ color: primaryColor }} />
            <h2 className="text-lg font-bold text-gray-800">Crop Image</h2>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <X size={24} />
          </button>
        </div>

        {/* Cropper Area */}
        <div className="relative flex-1 min-h-[300px] md:min-h-[400px] bg-gray-900">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={getAspectRatio(aspectRatio)}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={handleCropComplete}
            cropShape="rect"
            showGrid={true}
          />
        </div>

        {/* Controls */}
        <div className="p-4 border-t bg-gray-50 space-y-4">
          {/* Zoom Control */}
          <div className="flex items-center gap-3">
            <ZoomOut size={18} className="text-gray-500" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                accentColor: primaryColor
              }}
            />
            <ZoomIn size={18} className="text-gray-500" />
          </div>

          {/* Aspect Ratio & Rotation */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Aspect Ratio Buttons */}
            {allowAspectChange && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 font-medium">Aspect:</span>
                {aspectOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleAspectChange(option.value)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      aspectRatio === option.value
                        ? 'text-white'
                        : 'text-gray-600 bg-gray-200 hover:bg-gray-300'
                    }`}
                    style={{
                      backgroundColor: aspectRatio === option.value ? primaryColor : undefined
                    }}
                    disabled={loading}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {/* Rotation Button */}
            <button
              onClick={handleRotate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
              disabled={loading}
            >
              <RotateCw size={16} />
              Rotate
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !croppedAreaPixels}
            className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ backgroundColor: loading ? undefined : primaryColor }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing...
              </>
            ) : (
              'Apply Crop'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;
