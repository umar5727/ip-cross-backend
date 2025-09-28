const Download = require('./download.model');
const DownloadDescription = require('./download_description.model');
const ProductToDownload = require('./product_to_download.model');

// Export models directly
const models = {
  Download: Download,
  DownloadDescription: DownloadDescription,
  ProductToDownload: ProductToDownload
};

module.exports = models;