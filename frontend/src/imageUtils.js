// Image utilities for AddBus.jsx - handles compression and validation

/**
 * Compresses an image file to a target size while maintaining quality
 * @param {File} file - Original image file
 * @param {number} maxSizeKB - Maximum size in KB
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<string>} - Compressed image as data URL
 */
export function compressImage(file, maxSizeKB = 80, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = function () {
            // Calculate new dimensions to maintain aspect ratio
            const maxDimension = 800; // Max width or height
            let { width, height } = img;

            if (width > height && width > maxDimension) {
                height = (height * maxDimension) / width;
                width = maxDimension;
            } else if (height > maxDimension) {
                width = (width * maxDimension) / height;
                height = maxDimension;
            }

            canvas.width = width;
            canvas.height = height;

            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);

            // Try different quality levels to hit target size
            let currentQuality = quality;
            let attempts = 0;
            const maxAttempts = 5;

            function tryCompress() {
                const dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
                const sizeKB = Math.round(dataUrl.length / 1024);

                if (sizeKB <= maxSizeKB || attempts >= maxAttempts) {
                    resolve(dataUrl);
                } else {
                    currentQuality *= 0.8; // Reduce quality
                    attempts++;
                    tryCompress();
                }
            }

            tryCompress();
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
}

/**
 * Validates image files before processing
 * @param {FileList} files - Selected files
 * @returns {object} - Validation result with errors and valid files
 */
export function validateImageFiles(files) {
    const errors = [];
    const validFiles = [];
    const maxFileSize = 10 * 1024 * 1024; // 10MB original file size limit
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    Array.from(files).forEach((file, index) => {
        // Check file type
        if (!allowedTypes.includes(file.type)) {
            errors.push(`File ${index + 1} (${file.name}): Invalid format. Use JPG, PNG, or WebP.`);
            return;
        }

        // Check file size
        if (file.size > maxFileSize) {
            const sizeMB = Math.round(file.size / (1024 * 1024));
            errors.push(`File ${index + 1} (${file.name}): Too large (${sizeMB}MB). Max: 10MB.`);
            return;
        }

        validFiles.push(file);
    });

    return { errors, validFiles };
}

/**
 * Validates processed photos array for database constraints
 * @param {Array} photos - Array of processed photos with data URLs
 * @returns {Array} - Array of error messages
 */
export function validatePhotosForDatabase(photos) {
    const errors = [];
    const MAX_IMAGE_SIZE_KB = 80;
    const MAX_TOTAL_PAYLOAD_KB = 350; // Leave buffer for other bus data
    const MAX_IMAGES = 5;

    if (photos.length > MAX_IMAGES) {
        errors.push(`Too many images (${photos.length}). Maximum: ${MAX_IMAGES}.`);
    }

    let totalSizeKB = 0;

    photos.forEach((photo, index) => {
        const sizeKB = Math.round(photo.data.length / 1024);
        totalSizeKB += sizeKB;

        if (sizeKB > MAX_IMAGE_SIZE_KB) {
            errors.push(`Image ${index + 1} (${photo.name}) is too large: ${sizeKB}KB. Max: ${MAX_IMAGE_SIZE_KB}KB.`);
        }
    });

    if (totalSizeKB > MAX_TOTAL_PAYLOAD_KB) {
        errors.push(`Total images too large: ${totalSizeKB}KB. Max: ${MAX_TOTAL_PAYLOAD_KB}KB.`);
    }

    return errors;
}

/**
 * Validates processed photos array for S3 storage
 * @param {Array} photos - Array of processed photos with urls
 * @returns {Array} - Array of error messages
 */
export function validatePhotosForS3(photos) {
    const errors = [];
    const MAX_IMAGES = 5;

    if (photos.length > MAX_IMAGES) {
        errors.push(`Too many images (${photos.length}). Maximum: ${MAX_IMAGES}.`);
    }

    return errors;
}

/**
 * Processes and uploads image files to S3
 * @param {FileList} files - Selected image files
 * @param {Function} onProgress - Progress callback (current, total)
 * @returns {Promise<object>} - Result with photo URLs and any errors
 */
export async function processAndUploadImageFiles(files, onProgress = () => { }) {
    // Import uploadBusPhoto here to avoid circular dependencies
    const { uploadBusPhoto } = await import('./api');

    // First, validate the raw files
    const { errors: fileErrors, validFiles } = validateImageFiles(files);
    if (fileErrors.length > 0) {
        return { photos: [], errors: fileErrors };
    }

    const photos = [];
    const errors = [];

    // Process each valid file
    for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        onProgress(i + 1, validFiles.length);

        try {
            // Upload the file to S3
            const objectUrl = await uploadBusPhoto(file);
            photos.push({
                name: file.name,
                url: objectUrl,
                originalSize: Math.round(file.size / 1024),
            });
        } catch (error) {
            errors.push(`Failed to process ${file.name}: ${error.message}`);
        }
    }

    // Validate the final photos array
    const photoErrors = validatePhotosForS3(photos);
    errors.push(...photoErrors);

    return { photos, errors };
}

/**
 * Processes image files with compression and validation (local storage version)
 * @param {FileList} files - Selected image files
 * @param {Function} onProgress - Progress callback (current, total)
 * @returns {Promise<object>} - Result with photos array and any errors
 */
export async function processImageFiles(files, onProgress = () => { }) {
    // First, validate the raw files
    const { errors: fileErrors, validFiles } = validateImageFiles(files);
    if (fileErrors.length > 0) {
        return { photos: [], errors: fileErrors };
    }

    const photos = [];
    const errors = [];

    // Process each valid file
    for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        onProgress(i + 1, validFiles.length);

        try {
            const compressedDataUrl = await compressImage(file);
            photos.push({
                name: file.name,
                data: compressedDataUrl,
                originalSize: Math.round(file.size / 1024),
                compressedSize: Math.round(compressedDataUrl.length / 1024)
            });
        } catch (error) {
            errors.push(`Failed to process ${file.name}: ${error.message}`);
        }
    }

    // Validate the final photos array
    const dbErrors = validatePhotosForDatabase(photos);
    errors.push(...dbErrors);

    return { photos, errors };
}