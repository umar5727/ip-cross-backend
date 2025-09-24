const Product = require('./product/product.model');
const ProductDescription = require('./product/product_description.model');
const ProductImage = require('./product/product_image.model');
const ProductSpecial = require('./product/product_special.model');
const ProductDiscount = require('./product/product_discount.model');
const ProductVariant = require('./product/product_variant.model');

// Add relationship for ProductDiscount
Product.hasMany(ProductDiscount, { foreignKey: 'product_id' });
ProductDiscount.belongsTo(Product, { foreignKey: 'product_id' });
const Category = require('./category/category.model');
const CategoryDescription = require('./category/category_description.model');
const Customer = require('./customer/customer.model');
const Order = require('./customer/order.model');
const OrderProduct = require('./customer/order_product.model');
const OrderHistory = require('./customer/order_history.model');
const OrderStatus = require('./customer/order_status.model');
const OrderTotal = require('./customer/order_total.model');
const ProductCategory = require('./product/product_category.model');
const Cart = require('./cart/cart.model');
const Ticket = require('./ticket/ticket.model');
const TicketReply = require('./ticket/ticket_reply.model');
const { Referral, Offer, ReferralOrder } = require('./referral');

// Define relationships
// Many-to-many relationship between Product and Category
Product.belongsToMany(Category, { 
  through: ProductCategory,
  foreignKey: 'product_id',
  otherKey: 'category_id'
});

Category.belongsToMany(Product, { 
  through: ProductCategory,
  foreignKey: 'category_id',
  otherKey: 'product_id'
});

// Product relationships
Product.hasMany(ProductSpecial, { foreignKey: 'product_id' });
ProductSpecial.belongsTo(Product, { foreignKey: 'product_id' });

Product.hasMany(ProductImage, { foreignKey: 'product_id', as: 'ProductImages' });
ProductImage.belongsTo(Product, { foreignKey: 'product_id', as: 'Product' });

Product.hasMany(ProductDescription, { foreignKey: 'product_id', as: 'ProductDescriptions' });
ProductDescription.belongsTo(Product, { foreignKey: 'product_id', as: 'Product' });

Product.hasMany(ProductVariant, { foreignKey: 'product_id' });
ProductVariant.belongsTo(Product, { foreignKey: 'product_id' });

// Category relationships
Category.hasMany(CategoryDescription, { foreignKey: 'category_id' });
CategoryDescription.belongsTo(Category, { foreignKey: 'category_id' });

// Order relationships
Customer.hasMany(Order, { foreignKey: 'customer_id' });
Order.belongsTo(Customer, { foreignKey: 'customer_id' });

Order.hasMany(OrderProduct, { foreignKey: 'order_id', as: 'OrderProducts' });
OrderProduct.belongsTo(Order, { foreignKey: 'order_id', as: 'Order' });
OrderProduct.belongsTo(Product, { foreignKey: 'product_id', as: 'Product' });
Product.hasMany(OrderProduct, { foreignKey: 'product_id', as: 'OrderProducts' });

// Cart relationships
Product.hasMany(Cart, { foreignKey: 'product_id' });
Cart.belongsTo(Product, { foreignKey: 'product_id' });

Order.hasMany(OrderHistory, { foreignKey: 'order_id', as: 'OrderHistories' });
OrderHistory.belongsTo(Order, { foreignKey: 'order_id', as: 'Order' });
OrderHistory.belongsTo(OrderStatus, { foreignKey: 'order_status_id', as: 'order_status' });
OrderStatus.hasMany(OrderHistory, { foreignKey: 'order_status_id', as: 'order_histories' });

Order.hasMany(OrderTotal, { foreignKey: 'order_id', as: 'OrderTotals' });
OrderTotal.belongsTo(Order, { foreignKey: 'order_id', as: 'Order' });

Order.belongsTo(OrderStatus, { foreignKey: 'order_status_id', targetKey: 'order_status_id', as: 'order_status' });
OrderStatus.hasMany(Order, { foreignKey: 'order_status_id', as: 'orders' });

// Ticket relationships
Customer.hasMany(Ticket, { foreignKey: 'customer_id' });
Ticket.belongsTo(Customer, { foreignKey: 'customer_id' });

Ticket.hasMany(TicketReply, { foreignKey: 'ticket_id', as: 'TicketReplies' });
TicketReply.belongsTo(Ticket, { foreignKey: 'ticket_id' });

Customer.hasMany(TicketReply, { foreignKey: 'customer_id' });
TicketReply.belongsTo(Customer, { foreignKey: 'customer_id' });

module.exports = {
  Customer,
  Product,
  Category,
  CategoryDescription,
  Order,
  OrderProduct,
  OrderHistory,
  OrderStatus,
  OrderTotal,
  ProductCategory,
  ProductSpecial,
  ProductDescription,
  ProductImage,
  ProductVariant,
  Cart,
  Ticket,
  TicketReply,
  Referral,
  Offer,
  ReferralOrder
};