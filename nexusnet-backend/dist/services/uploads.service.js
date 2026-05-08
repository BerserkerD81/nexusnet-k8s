"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadsService = exports.UploadsService = void 0;
/**
 * Service for handling image uploads.
 * Stores images as base64 in mediaUrls array to keep data self-contained.
 * For production, consider using S3, GCS, or Cloudinary.
 */
class UploadsService {
    /**
     * Converts a file buffer to base64 data URL for storage.
     * This allows mediaUrls to be self-contained and portable.
     */
    async processImageFile(file) {
        if (!file)
            throw new Error('No file provided');
        if (!file.mimetype.startsWith('image/')) {
            throw new Error(`Invalid file type: ${file.mimetype}. Only images are allowed.`);
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            throw new Error('File too large. Maximum size is 5MB.');
        }
        // Convert buffer to base64
        const base64 = file.buffer.toString('base64');
        const dataUrl = `data:${file.mimetype};base64,${base64}`;
        return dataUrl;
    }
    /**
     * Process multiple image files for a post.
     */
    async processImageFiles(files) {
        if (!files || files.length === 0)
            return [];
        const mediaUrls = await Promise.all(files.map((file) => this.processImageFile(file)));
        return mediaUrls;
    }
    /**
     * Validate image files before processing.
     */
    validateImages(files) {
        if (!files || files.length === 0)
            return;
        if (files.length > 4) {
            throw new Error('Maximum 4 images per post.');
        }
        files.forEach((file) => {
            if (!file.mimetype.startsWith('image/')) {
                throw new Error(`Invalid file type: ${file.mimetype}`);
            }
            if (file.size > 5 * 1024 * 1024) {
                throw new Error('File too large. Maximum size is 5MB.');
            }
        });
    }
}
exports.UploadsService = UploadsService;
exports.uploadsService = new UploadsService();
