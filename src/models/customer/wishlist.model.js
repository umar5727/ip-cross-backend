const { DataTypes, Op } = require('sequelize');
const sequelize = require('../../../config/database');

const Wishlist = sequelize.define('wishlist', {
  customer_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    field: 'customer_id',
    references: {
      model: 'oc_customer',
      key: 'customer_id'
    }
  },
  product_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    field: 'product_id',
    references: {
      model: 'oc_product',
      key: 'product_id'
    }
  },
  date_added: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'date_added'
  }
}, {
  tableName: 'oc_customer_wishlist',
  timestamps: false
});

// Static methods for wishlist operations
Wishlist.addToWishlist = async function(customerId, productId) {
  try {
    // First, remove if already exists (to update date_added)
    await this.removeFromWishlist(customerId, productId);
    
    // Add to wishlist
    const wishlistItem = await this.create({
      customer_id: customerId,
      product_id: productId,
      date_added: new Date()
    });

    return wishlistItem;
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    throw error;
  }
};

Wishlist.removeFromWishlist = async function(customerId, productId) {
  try {
    const deletedRowsCount = await this.destroy({
      where: {
        customer_id: customerId,
        product_id: productId
      }
    });

    return deletedRowsCount;
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    throw error;
  }
};

Wishlist.getWishlist = async function(customerId) {
  try {
    const wishlistItems = await this.findAll({
      where: {
        customer_id: customerId
      },
      order: [['date_added', 'DESC']]
    });

    return wishlistItems;
  } catch (error) {
    console.error('Error getting wishlist:', error);
    throw error;
  }
};

Wishlist.getWishlistWithProducts = async function(customerId) {
  try {
    // First get the basic wishlist items
    const wishlistItems = await this.findAll({
      where: {
        customer_id: customerId
      },
      order: [['date_added', 'DESC']]
    });

    if (!wishlistItems || wishlistItems.length === 0) {
      return [];
    }

    console.log(`Found ${wishlistItems.length} wishlist items for customer ${customerId}`);
    console.log('Wishlist items:', wishlistItems.map(item => item.product_id));

    // Try to get real product data for each item
    const results = [];
    for (const item of wishlistItems) {
      try {
        console.log(`Getting product details for product ${item.product_id}`);
        
        // Use the exact same query structure as the working popular products
        const productData = await sequelize.query(`
          SELECT 
            p.model,
            p.sku,
            p.price,
            p.date_available,
            pd.name,
            pi.image
          FROM oc_product p
          LEFT JOIN oc_product_description pd ON p.product_id = pd.product_id AND pd.language_id = 1
          LEFT JOIN oc_product_image pi ON p.product_id = pi.product_id AND pi.sort_order = 0
          WHERE p.product_id = ?
        `, {
          replacements: [item.product_id],
          type: sequelize.QueryTypes.SELECT
        });

        console.log(`Product ${item.product_id} query result:`, productData);

        if (productData && productData.length > 0) {
          const product = productData[0];
          console.log(`Found product data for ${item.product_id}:`, product.name);
          results.push({
            customer_id: item.customer_id,
            product_id: item.product_id,
            date_added: item.date_added,
            name: product.name || `Product ${item.product_id}`,
            model: product.model || '',
            sku: product.sku || '',
            price: product.price ? parseFloat(product.price) : 0,
            special: null,
            date_available: product.date_available || null,
            image: product.image || null
          });
        } else {
          console.log(`No product data found for ${item.product_id}, using fallback`);
          // Fallback to basic data if product not found
          results.push({
            customer_id: item.customer_id,
            product_id: item.product_id,
            date_added: item.date_added,
            name: `Product ${item.product_id}`,
            model: '',
            sku: '',
            price: 0,
            special: null,
            date_available: null,
            image: null
          });
        }
      } catch (productError) {
        console.error(`Error getting product details for product ${item.product_id}:`, productError);
        // Fallback to basic data
        results.push({
          customer_id: item.customer_id,
          product_id: item.product_id,
          date_added: item.date_added,
          name: `Product ${item.product_id}`,
          model: '',
          sku: '',
          price: 0,
          special: null,
          date_available: null,
          image: null
        });
      }
    }

    console.log(`Returning ${results.length} wishlist items with product data`);
    return results;
  } catch (error) {
    console.error('Error getting wishlist with products:', error);
    // Return empty array if all else fails
    return [];
  }
};

Wishlist.getTotalWishlist = async function(customerId) {
  try {
    const count = await this.count({
      where: {
        customer_id: customerId
      }
    });

    return count;
  } catch (error) {
    console.error('Error getting total wishlist:', error);
    throw error;
  }
};

Wishlist.isInWishlist = async function(customerId, productId) {
  try {
    const wishlistItem = await this.findOne({
      where: {
        customer_id: customerId,
        product_id: productId
      }
    });

    return !!wishlistItem;
  } catch (error) {
    console.error('Error checking wishlist status:', error);
    throw error;
  }
};

Wishlist.clearWishlist = async function(customerId) {
  try {
    const deletedRowsCount = await this.destroy({
      where: {
        customer_id: customerId
      }
    });

    return deletedRowsCount;
  } catch (error) {
    console.error('Error clearing wishlist:', error);
    throw error;
  }
};

Wishlist.getWishlistByDateRange = async function(customerId, startDate, endDate) {
  try {
    const wishlistItems = await this.findAll({
      where: {
        customer_id: customerId,
        date_added: {
          [Op.between]: [startDate, endDate]
        }
      },
      order: [['date_added', 'DESC']]
    });

    return wishlistItems;
  } catch (error) {
    console.error('Error getting wishlist by date range:', error);
    throw error;
  }
};

Wishlist.getPopularWishlistProducts = async function(limit = 10) {
  try {
    const results = await sequelize.query(`
      SELECT 
        w.product_id,
        COUNT(*) as wishlist_count,
        p.model,
        p.price,
        NULL as special,
        p.status,
        pd.name,
        pi.image
      FROM oc_customer_wishlist w
      LEFT JOIN oc_product p ON w.product_id = p.product_id
      LEFT JOIN oc_product_description pd ON w.product_id = pd.product_id AND pd.language_id = 1
      LEFT JOIN oc_product_image pi ON w.product_id = pi.product_id AND pi.sort_order = 0
      WHERE p.status = 1
      GROUP BY w.product_id
      ORDER BY wishlist_count DESC
      LIMIT ?
    `, {
      replacements: [limit],
      type: sequelize.QueryTypes.SELECT
    });

    return results;
  } catch (error) {
    console.error('Error getting popular wishlist products:', error);
    throw error;
  }
};

module.exports = Wishlist;
