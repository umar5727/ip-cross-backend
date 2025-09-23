const Wishlist = require('../../models/customer/wishlist.model');
const Product = require('../../models/product/product.model');

// Get wishlist for a customer
exports.getWishlist = async (req, res) => {
  try {
    const customerId = req.customer.customer_id;
    const wishlistItems = await Wishlist.getWishlistWithProducts(customerId);

    // Ensure wishlistItems is an array
    if (!Array.isArray(wishlistItems)) {
      console.error('Wishlist items is not an array:', wishlistItems);
      return res.status(200).json({
        success: true,
        data: {
          wishlist: []
        }
      });
    }

    // Format the response with product details
    const formattedWishlist = wishlistItems.map(item => ({
      customer_id: item.customer_id,
      product_id: item.product_id,
      date_added: item.date_added,
      product: {
        name: item.name,
        model: item.model,
        sku: item.sku,
        price: parseFloat(item.price),
        special: item.special ? parseFloat(item.special) : null,
        date_available: item.date_available,
        image: item.image
      }
    }));

    res.status(200).json({
      success: true,
      data: {
        wishlist: formattedWishlist
      }
    });
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not get wishlist'
    });
  }
};

// Add product to wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const customerId = req.customer.customer_id;
    const { product_id } = req.body;

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // Check if product exists (commented out for testing)
    // const product = await Product.findByPk(product_id);
    // if (!product) {
    //   return res.status(404).json({
    //     success: false,
    //     message: 'Product not found'
    //   });
    // }

    // Check if product is already in wishlist
    const isInWishlist = await Wishlist.isInWishlist(customerId, product_id);
    if (isInWishlist) {
      return res.status(400).json({
        success: false,
        message: 'Product is already in wishlist'
      });
    }

    await Wishlist.addToWishlist(customerId, product_id);

    // Get updated wishlist count
    const totalCount = await Wishlist.getTotalWishlist(customerId);

    res.status(200).json({
      success: true,
      message: 'Product added to wishlist successfully',
      data: {
        product_id: product_id,
        total_wishlist_items: totalCount
      }
    });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not add product to wishlist'
    });
  }
};

// Remove product from wishlist
exports.removeFromWishlist = async (req, res) => {
  try {
    const customerId = req.customer.customer_id;
    const { productId } = req.params;
    const product_id = productId;

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    const deletedRowsCount = await Wishlist.removeFromWishlist(customerId, parseInt(product_id));

    if (deletedRowsCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in wishlist'
      });
    }

    // Get updated wishlist count
    const totalCount = await Wishlist.getTotalWishlist(customerId);

    res.status(200).json({
      success: true,
      message: 'Product removed from wishlist successfully',
      data: {
        product_id: parseInt(product_id),
        total_wishlist_items: totalCount
      }
    });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not remove product from wishlist'
    });
  }
};

// Get total wishlist count
exports.getWishlistCount = async (req, res) => {
  try {
    const customerId = req.customer.customer_id;
    const totalCount = await Wishlist.getTotalWishlist(customerId);

    res.status(200).json({
      success: true,
      data: {
        total_items: totalCount
      }
    });
  } catch (error) {
    console.error('Get wishlist count error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not get wishlist count'
    });
  }
};

// Check if product is in wishlist
exports.checkWishlistStatus = async (req, res) => {
  try {
    const customerId = req.customer.customer_id;
    const { productId } = req.params;
    const product_id = productId;

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    const isInWishlist = await Wishlist.isInWishlist(customerId, parseInt(product_id));

    res.status(200).json({
      success: true,
      data: {
        product_id: parseInt(product_id),
        is_in_wishlist: isInWishlist
      }
    });
  } catch (error) {
    console.error('Check wishlist status error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not check wishlist status'
    });
  }
};

// Clear entire wishlist
exports.clearWishlist = async (req, res) => {
  try {
    const customerId = req.customer.customer_id;
    const deletedRowsCount = await Wishlist.clearWishlist(customerId);

    res.status(200).json({
      success: true,
      message: 'Wishlist cleared successfully',
      data: {
        removed_items: deletedRowsCount
      }
    });
  } catch (error) {
    console.error('Clear wishlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not clear wishlist'
    });
  }
};

// Get wishlist by date range
exports.getWishlistByDateRange = async (req, res) => {
  try {
    const customerId = req.customer.customer_id;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const startDate = new Date(start_date + 'T00:00:00.000Z');
    const endDate = new Date(end_date + 'T23:59:59.999Z');

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    const wishlistItems = await Wishlist.getWishlistByDateRange(customerId, startDate, endDate);

    res.status(200).json({
      success: true,
      data: {
        wishlist: wishlistItems,
        date_range: {
          start_date: startDate,
          end_date: endDate
        }
      }
    });
  } catch (error) {
    console.error('Get wishlist by date range error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not get wishlist by date range'
    });
  }
};

// Get popular wishlist products (admin/public endpoint)
exports.getPopularWishlistProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const popularProducts = await Wishlist.getPopularWishlistProducts(parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        popular_products: popularProducts
      }
    });
  } catch (error) {
    console.error('Get popular wishlist products error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not get popular wishlist products'
    });
  }
};

// Toggle wishlist status (add if not exists, remove if exists)
exports.toggleWishlist = async (req, res) => {
  try {
    const customerId = req.customer.customer_id;
    const { product_id } = req.body;

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // Check if product exists (commented out for testing)
    // const product = await Product.findByPk(product_id);
    // if (!product) {
    //   return res.status(404).json({
    //     success: false,
    //     message: 'Product not found'
    //   });
    // }

    const isInWishlist = await Wishlist.isInWishlist(customerId, product_id);

    if (isInWishlist) {
      // Remove from wishlist
      await Wishlist.removeFromWishlist(customerId, product_id);
      const totalCount = await Wishlist.getTotalWishlist(customerId);
      
      res.status(200).json({
        success: true,
        message: 'Product removed from wishlist',
        data: {
          product_id: product_id,
          action: 'removed',
          total_wishlist_items: totalCount
        }
      });
    } else {
      // Add to wishlist
      await Wishlist.addToWishlist(customerId, product_id);
      const totalCount = await Wishlist.getTotalWishlist(customerId);
      
      res.status(200).json({
        success: true,
        message: 'Product added to wishlist',
        data: {
          product_id: product_id,
          action: 'added',
          total_wishlist_items: totalCount
        }
      });
    }
  } catch (error) {
    console.error('Toggle wishlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not toggle wishlist status'
    });
  }
};
