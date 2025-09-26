/**
 * Utility function to resize images (simulates PHP's resize functionality)
 * @param {string} imagePath - Path to the image
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @returns {string} - URL to the resized image
 */
exports.resizeImage = (imagePath, width, height) => {
  // In a real implementation, this would use a library like Sharp to resize the image
  // For now, we'll just return a URL that could be handled by a middleware
  if (!imagePath) {
    return 'placeholder.png';
  }
  
  // Remove 'catalog/' prefix if present as it's typically part of the path
  const cleanPath = imagePath.startsWith('catalog/') ? imagePath : `catalog/${imagePath}`;
  
  // Return a URL that could be handled by an image resizing middleware
  return `/image/${cleanPath}?width=${width}&height=${height}`;
};