// Enhanced photo upload section for AddBus.jsx
// Replace the existing photo upload section with this improved version

import { processImageFiles, validatePhotosForDatabase } from '../imageUtils';

// Add these to the state variables in AddBus.jsx:
const [photos, setPhotos] = useState([]);
const [isDragging, setIsDragging] = useState(false);
const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
const [isProcessingImages, setIsProcessingImages] = useState(false);

// Replace the existing photo handling functions with these:

const handlePhotos = async (eOrFiles) => {
    const files = eOrFiles?.target?.files ?? eOrFiles ?? [];
    if (!files.length) return;

    setIsProcessingImages(true);
    setUploadProgress({ current: 0, total: files.length });

    try {
        const result = await processImageFiles(files, (current, total) => {
            setUploadProgress({ current, total });
        });

        if (result.errors.length > 0) {
            setErrors(prev => [...prev, ...result.errors]);
        }

        if (result.photos.length > 0) {
            setPhotos(prev => [...prev, ...result.photos]);

            // Show compression info to user
            const compressionInfo = result.photos.map(p =>
                `${p.name}: ${p.originalSize}KB → ${p.compressedSize}KB`
            ).join(', ');
            console.log('Images compressed:', compressionInfo);
        }

    } catch (error) {
        setErrors(prev => [...prev, `Failed to process images: ${error.message}`]);
    } finally {
        setIsProcessingImages(false);
        setUploadProgress({ current: 0, total: 0 });
    }
};

const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files && files.length) {
        handlePhotos(files);
    }
};

const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
};

const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
};

const handleRemovePhoto = (idx) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
};

// Add this validation to the handleSubmit function, before creating the payload:
const photoValidationErrors = validatePhotosForDatabase(photos);
if (photoValidationErrors.length > 0) {
    setErrors([...errs, ...photoValidationErrors]);
    return;
}

// Enhanced photo upload section JSX:
export const PhotoUploadSection = () => {
    const totalPhotosSize = Math.round(
        photos.reduce((sum, photo) => sum + photo.data.length, 0) / 1024
    );

    return (
        <section className="add-bus__section">
            <h3 className="home__section-title">Bus Photos (Optional)</h3>
            <div className="add-bus__photos">

                {/* Upload area */}
                <label
                    htmlFor="bus-photos"
                    className={`add-bus__photo-dropzone ${isDragging ? 'add-bus__photo-dropzone--active' : ''}`}
                    onDragEnter={handleDragOver}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className="add-bus__photo-dropzone-icon" aria-hidden="true">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 7a2 2 0 0 1 2-2h2.172a2 2 0 0 0 1.414-.586L10.414 5H14a2 2 0 0 1 2 2h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                    </div>
                    <div className="add-bus__photo-dropzone-text">
                        <strong>Click to upload photos</strong>
                        <span>or drag & drop</span>
                    </div>
                    <input
                        id="bus-photos"
                        type="file"
                        accept="image/*"
                        multiple
                        className="add-bus__file-input add-bus__file-input--hidden"
                        onChange={handlePhotos}
                        disabled={isProcessingImages}
                    />
                </label>

                {/* Upload constraints info */}
                <div className="add-bus__photo-hint">
                    📋 JPG, PNG, WebP up to 10MB each • Auto-compressed for storage
                    <br />
                    📊 Total size: {totalPhotosSize}KB / 350KB • Images: {photos.length} / 5
                </div>

                {/* Processing progress */}
                {isProcessingImages && (
                    <div className="add-bus__processing" style={{
                        padding: '0.75rem',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '0.5rem',
                        marginTop: '0.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div className="spinner" style={{
                                width: '16px',
                                height: '16px',
                                border: '2px solid #e5e7eb',
                                borderTop: '2px solid #3b82f6',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }}></div>
                            Processing images... ({uploadProgress.current}/{uploadProgress.total})
                        </div>
                    </div>
                )}

                {/* Current photos count */}
                {photos.length > 0 && (
                    <div className="add-bus__photo-count">
                        {photos.length} photo{photos.length > 1 ? 's' : ''} ready for upload
                        {totalPhotosSize > 280 && (
                            <span style={{ color: 'orange', marginLeft: '0.5rem' }}>
                                ⚠️ Near size limit
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Photo previews */}
            {photos.length > 0 && (
                <div className="add-bus__file-preview">
                    {photos.map((photo, i) => (
                        <div className="add-bus__thumb" key={i}>
                            <img src={photo.data} alt={photo.name || `Bus photo ${i + 1}`} />
                            <div className="add-bus__photo-info">
                                <div className="add-bus__photo-name">{photo.name}</div>
                                <div className="add-bus__photo-size">
                                    {photo.compressedSize}KB
                                    {photo.originalSize !== photo.compressedSize && (
                                        <span style={{ color: 'green', fontSize: '0.8em' }}>
                                            {' '}(was {photo.originalSize}KB)
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                className="add-bus__photo-remove"
                                aria-label={`Remove ${photo.name || `photo ${i + 1}`}`}
                                onClick={() => handleRemovePhoto(i)}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M6 7h12M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2m-7 0v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                                    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Size warning */}
            {totalPhotosSize > 350 && (
                <div style={{
                    color: 'red',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    marginTop: '0.5rem'
                }}>
                    ⚠️ Total image size ({totalPhotosSize}KB) exceeds database limit (350KB).
                    Please remove some images or they may not save properly.
                </div>
            )}
        </section>
    );
};

// Add this CSS for the spinner animation
const spinnerCSS = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;