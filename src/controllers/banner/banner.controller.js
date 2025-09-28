const MobileBanner = require('../../models/banner/mobile_banner.model');

// Get all banners for a specific device
exports.getBannersByDevice = async (req, res) => {
  try {
    const { device } = req.params;
    
    // Validate device parameter
    if (!['ios', 'android', 'tablet'].includes(device)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid device type. Must be ios, android, or tablet'
      });
    }

    const banners = await MobileBanner.getBannersByDevice(device);

    res.status(200).json({
      success: true,
      data: {
        device: device,
        banners: banners,
        count: banners.length
      }
    });
  } catch (error) {
    console.error('Get banners by device error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve banners'
    });
  }
};

// Get all banners (all devices)
exports.getAllBanners = async (req, res) => {
  try {
    const banners = await MobileBanner.getAllBanners();

    // Group banners by device
    const groupedBanners = {
      android: banners.filter(banner => banner.device === 'android'),
      ios: banners.filter(banner => banner.device === 'ios'),
      tablet: banners.filter(banner => banner.device === 'tablet')
    };

    res.status(200).json({
      success: true,
      data: {
        banners: groupedBanners,
        total_count: banners.length,
        device_counts: {
          android: groupedBanners.android.length,
          ios: groupedBanners.ios.length,
          tablet: groupedBanners.tablet.length
        }
      }
    });
  } catch (error) {
    console.error('Get all banners error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve banners'
    });
  }
};

// Get single banner by ID
exports.getBannerById = async (req, res) => {
  try {
    const { bannerId } = req.params;
    
    if (!bannerId || isNaN(bannerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid banner ID'
      });
    }

    const banner = await MobileBanner.getBannerById(parseInt(bannerId));

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    res.status(200).json({
      success: true,
      data: banner
    });
  } catch (error) {
    console.error('Get banner by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve banner'
    });
  }
};

// Get Android banners
exports.getAndroidBanners = async (req, res) => {
  try {
    const banners = await MobileBanner.getBannersByDevice('android');

    res.status(200).json({
      success: true,
      data: {
        device: 'android',
        banners: banners,
        count: banners.length
      }
    });
  } catch (error) {
    console.error('Get Android banners error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve Android banners'
    });
  }
};

// Get iOS banners
exports.getIOSBanners = async (req, res) => {
  try {
    const banners = await MobileBanner.getBannersByDevice('ios');

    res.status(200).json({
      success: true,
      data: {
        device: 'ios',
        banners: banners,
        count: banners.length
      }
    });
  } catch (error) {
    console.error('Get iOS banners error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve iOS banners'
    });
  }
};

// Get Tablet banners
exports.getTabletBanners = async (req, res) => {
  try {
    const banners = await MobileBanner.getBannersByDevice('tablet');

    res.status(200).json({
      success: true,
      data: {
        device: 'tablet',
        banners: banners,
        count: banners.length
      }
    });
  } catch (error) {
    console.error('Get Tablet banners error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve Tablet banners'
    });
  }
};
