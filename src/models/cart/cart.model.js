const { DataTypes, Op } = require('sequelize');
const sequelize = require('../../../config/database');
const Product = require('../product/product.model');
const ProductDescription = require('../product/product_description.model');
const ProductSpecial = require('../product/product_special.model');
const ProductDiscount = require('../product/product_discount.model');

const Cart = sequelize.define('cart', {
  cart_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  api_id: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  customer_id: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  session_id: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  recurring_id: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  date_added: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'oc_cart',
  timestamps: false,
  indexes: [
    {
      name: 'cart_customer_session_idx',
      fields: ['customer_id', 'session_id']
    },
    {
      name: 'cart_product_idx',
      fields: ['product_id']
    }
  ]
});

/**
 * Get cart items with product details for a customer
 * @param {number} customer_id - Customer ID
 * @returns {Promise<Array>} Cart items with product details
 */
Cart.getCartWithDetails = async function(customer_id) {
  try {
    // Set customer_group_id to 1 as requested
    const customer_group_id = 1;
    
    // Get cart items for the customer
    const cartItems = await Cart.findAll({
      where: { customer_id },
      raw: true
    });

    if (!cartItems || cartItems.length === 0) {
      return [];
    }

    // Get product details for each cart item
    const cartWithDetails = await Promise.all(cartItems.map(async (item) => {
      // Get product data
      const product = await Product.findByPk(item.product_id, { raw: true });
      
      if (!product) {
        return null; // Skip if product not found
      }
      
      // Get product description
      const productDescription = await ProductDescription.findOne({
        where: { product_id: item.product_id },
        raw: true
      });
      
      // Get product special price (selling_price) with customer_group_id filter
      const productSpecial = await ProductSpecial.findOne({
        where: { 
          product_id: item.product_id,
          customer_group_id: customer_group_id,
          date_start: { [Op.lte]: new Date() },
          date_end: { 
            [Op.or]: [
              { [Op.gte]: new Date() },
              { [Op.eq]: '0000-00-00' },
              { [Op.eq]: '0000-00-00 00:00:00' }
            ]
          }
        },
        order: [['priority', 'ASC']],
        raw: true
      });
      
      // Get product discount based on quantity and customer_group_id
      const productDiscount = await ProductDiscount.findOne({
        where: {
          product_id: item.product_id,
          customer_group_id: customer_group_id,
          quantity: { [Op.lte]: item.quantity },
          [Op.or]: [
            { max_quantity: { [Op.gte]: item.quantity } },
            { max_quantity: null }
          ],
          date_start: { [Op.lte]: new Date() },
          date_end: { 
            [Op.or]: [
              { [Op.gte]: new Date() },
              { [Op.eq]: '0000-00-00' },
              { [Op.eq]: '0000-00-00 00:00:00' }
            ]
          }
        },
        order: [['priority', 'ASC'], ['quantity', 'DESC']],
        raw: true
      });
      
      // Set mrp as the original price from product table
      const mrp = parseFloat(product.price);
      
      // Set selling_price from product special if available
      const selling_price = productSpecial ? parseFloat(productSpecial.price) : null;
      
      // Set discount_price from product discount if available
      const discount_price = productDiscount ? parseFloat(productDiscount.price) : null;
      
      // Price hierarchy: discount > special > mrp
      let finalPrice = mrp;
      if (discount_price !== null && discount_price > 0) {
        finalPrice = discount_price;
      } else if (selling_price !== null && selling_price > 0) {
        finalPrice = selling_price;
      }
      
      console.log(`Product ${item.product_id}: MRP=${mrp}, Special=${selling_price}, Discount=${discount_price}, Final=${finalPrice}`);
      
      // Combine all data
      return {
        ...item,
        product_data: {
          ...product,
          price: finalPrice, // Final calculated price for order
          mrp: mrp, // Store original MRP price
          selling_price: selling_price, // Store special price
          discount_price: discount_price, // Store discount price
          name: productDescription ? productDescription.name : '',
          description: productDescription ? productDescription.description : '',
          meta_title: productDescription ? productDescription.meta_title : '',
          meta_description: productDescription ? productDescription.meta_description : '',
          meta_keyword: productDescription ? productDescription.meta_keyword : '',
          tag: productDescription ? productDescription.tag : ''
        }
      };
    }));
    
    // Filter out null items (products not found)
    return cartWithDetails.filter(item => item !== null);
  } catch (error) {
    console.error('Error getting cart with details:', error);
    throw error;
  }
};

/**
 * Clear all cart items for a customer
 * @param {number} customer_id - Customer ID
 * @returns {Promise<number>} Number of deleted items
 */
Cart.clearCart = async function(customer_id) {
  try {
    const result = await Cart.destroy({
      where: { customer_id }
    });
    
    console.log(`Cleared ${result} items from cart for customer ${customer_id}`);
    return result;
  } catch (error) {
    console.error('Error clearing cart:', error);
    throw error;
  }
};

module.exports = Cart;