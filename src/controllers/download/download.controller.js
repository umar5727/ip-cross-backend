const path = require('path');
const fs = require('fs');

// Directory where downloads are stored
const DOWNLOAD_DIR = path.join(__dirname, '../../../downloads');

// Ensure download directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// Sample download data for testing
const sampleDownloads = [
  {
    download_id: 1,
    name: 'Sample Product Manual',
    date_added: new Date(),
    size: '2.5 MB',
    download_url: '/api/downloads/1'
  },
  {
    download_id: 2,
    name: 'Software Installation Guide',
    date_added: new Date(),
    size: '1.8 MB',
    download_url: '/api/downloads/2'
  }
];

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Get customer downloads
exports.getDownloads = async (req, res) => {
  try {
    // Get customer ID from authenticated user (set by auth middleware)
    const customerId = req.customer.customer_id;
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Return sample downloads for testing
    return res.status(200).json({
      success: true,
      data: {
        downloads: sampleDownloads,
        pagination: {
          total: sampleDownloads.length,
          page,
          limit,
          pages: Math.ceil(sampleDownloads.length / limit)
        }
      }
    });

    // Process downloads to include file size
    const processedDownloads = downloads.map(download => {
      const filePath = path.join(DOWNLOAD_DIR, download.filename);
      let size = 0;
      let sizeFormatted = '0 B';
      
      if (fs.existsSync(filePath)) {
        size = fs.statSync(filePath).size;
        sizeFormatted = formatFileSize(size);
      }

      return {
        download_id: download.download_id,
        name: download.descriptions[0]?.name || 'Unknown',
        date_added: download.date_added,
        size: sizeFormatted,
        download_url: `/api/downloads/${download.download_id}`
      };
    });

    // Count total downloads
    const totalDownloads = await Download.count({
      include: [
        {
          model: ProductToDownload,
          attributes: [],
          include: [
            {
              model: OrderProduct,
              attributes: [],
              include: [
                {
                  model: Order,
                  attributes: [],
                  where: {
                    customer_id: customerId,
                    order_status_id: { [Op.in]: completedOrderStatuses }
                  }
                }
              ]
            }
          ]
        }
      ]
    });

    return res.status(200).json({
      success: true,
      data: {
        downloads: processedDownloads,
        pagination: {
          total: totalDownloads,
          page,
          limit,
          pages: Math.ceil(totalDownloads / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching downloads:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not retrieve downloads'
    });
  }
};

// Download a specific file
exports.downloadFile = async (req, res) => {
  try {
    // Get customer ID from authenticated user (set by auth middleware)
    const customerId = req.customer.customer_id;
    const downloadId = req.params.downloadId;
    
    // For testing purposes, create a sample file if it doesn't exist
    const sampleFilePath = path.join(DOWNLOAD_DIR, `sample-${downloadId}.pdf`);
    if (!fs.existsSync(sampleFilePath)) {
      // Create a simple text file as a placeholder
      fs.writeFileSync(sampleFilePath, 'This is a sample download file for testing purposes.');
    }

    // Check if file exists
    if (!fs.existsSync(sampleFilePath)) {
      return res.status(404).json({
        success: false,
        message: 'Download file not found'
      });
    }

    // Get file stats
    const stats = fs.statSync(sampleFilePath);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="sample-download-${downloadId}.pdf"`);
    res.setHeader('Content-Length', stats.size);
    
    // Stream the file to the response
    const fileStream = fs.createReadStream(sampleFilePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file',
      error: error.message
    });
  }
};

// This function is already defined above