/**
 * Utility function to resize images using Sharp middleware
 * @param {string} imagePath - Path to the image
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @param {boolean} useExternalDomain - Whether to use the external domain (ipshopy.com)
 * @returns {string} - URL to the resized image
 */
exports.resizeImage = (imagePath, width, height, useExternalDomain = false) => {
  if (!imagePath) {
    return 'placeholder.png';
  }
  
  // Remove 'catalog/' prefix if present as it's typically part of the path
  const cleanPath = imagePath.startsWith('catalog/') ? imagePath : `catalog/${imagePath}`;
  
  // Build the image URL with width and height parameters
  const imageUrl = `/image/${cleanPath}?width=${width}&height=${height}`;
  
  // Add external domain if requested
  if (useExternalDomain) {
    return `https://www.ipshopy.com${imageUrl}`;
  }
  
  return imageUrl;
};

/**
 * Utility function to resize images with external domain
 * @param {string} imagePath - Path to the image
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @returns {string} - URL to the resized image with external domain
 */
exports.resizeImageExternal = (imagePath, width, height) => {
  return exports.resizeImage(imagePath, width, height, true);
};