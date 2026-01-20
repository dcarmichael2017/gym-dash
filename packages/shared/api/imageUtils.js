/**
 * Image utility functions for cropping and compression
 */

/**
 * Create an image element from a file or URL
 * @param {string|File} source - Image source (URL or File object)
 * @returns {Promise<HTMLImageElement>}
 */
export const createImage = (source) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));

    if (typeof source === 'string') {
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = source;
    } else {
      image.src = URL.createObjectURL(source);
    }
  });

/**
 * Get the cropped image canvas from crop area
 * @param {HTMLImageElement} image - The source image
 * @param {object} pixelCrop - The crop area in pixels { x, y, width, height }
 * @param {number} rotation - Rotation in degrees (optional, default 0)
 * @returns {Promise<HTMLCanvasElement>}
 */
export const getCroppedImgCanvas = async (image, pixelCrop, rotation = 0) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  canvas.width = safeArea;
  canvas.height = safeArea;

  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-safeArea / 2, -safeArea / 2);

  ctx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5
  );

  const data = ctx.getImageData(0, 0, safeArea, safeArea);

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
  );

  return canvas;
};

/**
 * Get cropped image as a Blob
 * @param {string|File} imageSrc - Source image
 * @param {object} pixelCrop - Crop area { x, y, width, height }
 * @param {number} rotation - Rotation in degrees
 * @param {object} options - Additional options
 * @param {number} options.maxWidth - Max output width (default 1200)
 * @param {number} options.maxHeight - Max output height (default 1200)
 * @param {number} options.quality - JPEG quality 0-1 (default 0.85)
 * @param {string} options.format - Output format 'image/jpeg' or 'image/png' (default 'image/jpeg')
 * @returns {Promise<{blob: Blob, width: number, height: number}>}
 */
export const getCroppedImg = async (
  imageSrc,
  pixelCrop,
  rotation = 0,
  options = {}
) => {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.85,
    format = 'image/jpeg'
  } = options;

  const image = await createImage(imageSrc);
  const canvas = await getCroppedImgCanvas(image, pixelCrop, rotation);

  // Scale down if necessary
  let finalCanvas = canvas;
  if (canvas.width > maxWidth || canvas.height > maxHeight) {
    finalCanvas = document.createElement('canvas');
    const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
    finalCanvas.width = Math.round(canvas.width * scale);
    finalCanvas.height = Math.round(canvas.height * scale);

    const ctx = finalCanvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, finalCanvas.width, finalCanvas.height);
  }

  return new Promise((resolve, reject) => {
    finalCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve({
          blob,
          width: finalCanvas.width,
          height: finalCanvas.height
        });
      },
      format,
      quality
    );
  });
};

/**
 * Compress an image file
 * @param {File} file - The image file to compress
 * @param {object} options - Compression options
 * @param {number} options.maxWidth - Max width (default 1200)
 * @param {number} options.maxHeight - Max height (default 1200)
 * @param {number} options.quality - JPEG quality 0-1 (default 0.85)
 * @returns {Promise<{blob: Blob, width: number, height: number}>}
 */
export const compressImage = async (file, options = {}) => {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.85
  } = options;

  const image = await createImage(file);

  // Calculate new dimensions while maintaining aspect ratio
  let width = image.width;
  let height = image.height;

  if (width > maxWidth || height > maxHeight) {
    const scale = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve({
          blob,
          width,
          height
        });
      },
      'image/jpeg',
      quality
    );
  });
};

/**
 * Convert a blob to a File object
 * @param {Blob} blob - The blob to convert
 * @param {string} filename - The filename for the new file
 * @returns {File}
 */
export const blobToFile = (blob, filename) => {
  return new File([blob], filename, { type: blob.type });
};

/**
 * Get aspect ratio dimensions for common presets
 * @param {string} preset - Aspect ratio preset ('1:1', '4:3', '16:9')
 * @returns {number} Aspect ratio as width/height
 */
export const getAspectRatio = (preset) => {
  const ratios = {
    '1:1': 1,
    '4:3': 4 / 3,
    '3:4': 3 / 4,
    '16:9': 16 / 9,
    '9:16': 9 / 16
  };
  return ratios[preset] || 1;
};
