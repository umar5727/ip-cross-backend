const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/**
 * Middleware for handling image resizing using Sharp
 * Converts images to WebP format for better compression
 */
const imageMiddleware = async (req, res, next) => {
  try {
    // Extract width and height from query parameters
    const width = parseInt(req.query.width) || null;
    const height = parseInt(req.query.height) || null;
    
    // If no width or height provided, just pass through
    if (!width && !height) {
      return next();
    }
    
    // Get the image path from the URL
    // URL format: /image/catalog/path/to/image.jpg
    const urlPath = req.path;
    const imagePath = urlPath.replace(/^\/image\//, '');
    
    // Determine the full path to the image file
    // Assuming images are stored in a directory at the project root
    const baseDir = path.join(__dirname, '../../');
    const fullImagePath = path.join(baseDir, imagePath);
    
    // Check if the file exists
    if (!fs.existsSync(fullImagePath)) {
      return res.status(404).send('Image not found');
    }
    
    // Create cache directory if it doesn't exist
    const cacheDir = path.join(baseDir, 'cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    // Generate cache filename
    const imageExt = path.extname(fullImagePath);
    const imageName = path.basename(fullImagePath, imageExt);
    const cachePath = path.join(
      cacheDir, 
      `${imageName}-${width}x${height}.webp`
    );
    
    // If cached version exists and is newer than the original, serve it
    if (fs.existsSync(cachePath)) {
      const originalStat = fs.statSync(fullImagePath);
      const cacheStat = fs.statSync(cachePath);
      
      if (cacheStat.mtime > originalStat.mtime) {
        return res.sendFile(cachePath);
      }
    }
    
    // Process the image with Sharp
    const sharpInstance = sharp(fullImagePath);
    
    // Resize if dimensions provided
    if (width || height) {
      sharpInstance.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    // Convert to WebP with good quality
    sharpInstance.webp({ quality: 80 });
    
    // Save to cache
    await sharpInstance.toFile(cachePath);
    
    // Send the processed image
    res.sendFile(cachePath);
    
  } catch (error) {
    console.error('Image processing error:', error);
    next(error);
  }
};

module.exports = imageMiddleware;