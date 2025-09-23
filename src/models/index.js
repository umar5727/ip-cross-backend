const Product = require('./product/product.model');
const ProductDescription = require('./product/product_description.model');
const ProductImage = require('./product/product_image.model');
const ProductSpecial = require('./product/product_special.model');
const ProductVariant = require('./product/product_variant.model');
const Category = require('./category/category.model');
const CategoryDescription = require('./category/category_description.model');
const Customer = require('./customer/customer.model');
const Order = require('./order/order.model');
const OrderProduct = require('./order/order_product.model');
const OrderHistory = require('./order/order_history.model');
const ProductCategory = require('./product/product_category.model');
const Cart = require('./cart/cart.model');
const Address = require('./customer/address.model');
const Wishlist = require('./customer/wishlist.model');
const CustomerAccount = require('./customer/customer_account.model');
const PincodeHistory = require('./customer/pincode_history.model');

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

Product.hasMany(ProductImage, { foreignKey: 'product_id' });
ProductImage.belongsTo(Product, { foreignKey: 'product_id' });

Product.hasMany(ProductDescription, { foreignKey: 'product_id' });
ProductDescription.belongsTo(Product, { foreignKey: 'product_id' });

Product.hasMany(ProductVariant, { foreignKey: 'product_id' });
ProductVariant.belongsTo(Product, { foreignKey: 'product_id' });

// Category relationships
Category.hasMany(CategoryDescription, { foreignKey: 'category_id' });
CategoryDescription.belongsTo(Category, { foreignKey: 'category_id' });

// Order relationships
Customer.hasMany(Order, { foreignKey: 'customer_id' });
Order.belongsTo(Customer, { foreignKey: 'customer_id' });

Order.hasMany(OrderProduct, { foreignKey: 'order_id' });

// Cart relationships
Product.hasMany(Cart, { foreignKey: 'product_id' });
Cart.belongsTo(Product, { foreignKey: 'product_id' });
OrderProduct.belongsTo(Order, { foreignKey: 'order_id' });

Order.hasMany(OrderHistory, { foreignKey: 'order_id' });
OrderHistory.belongsTo(Order, { foreignKey: 'order_id' });

// Customer relationships
Customer.hasMany(Address, { foreignKey: 'customer_id' });
Address.belongsTo(Customer, { foreignKey: 'customer_id' });

Customer.hasMany(Wishlist, { foreignKey: 'customer_id' });
Wishlist.belongsTo(Customer, { foreignKey: 'customer_id' });

Product.hasMany(Wishlist, { foreignKey: 'product_id' });
Wishlist.belongsTo(Product, { foreignKey: 'product_id' });

Customer.hasMany(PincodeHistory, { foreignKey: 'customer_id' });
PincodeHistory.belongsTo(Customer, { foreignKey: 'customer_id' });

module.exports = {
  Customer,
  Product,
  Category,
  CategoryDescription,
  Order,
  OrderProduct,
  OrderHistory,
  ProductCategory,
  ProductSpecial,
  ProductDescription,
  ProductImage,
  ProductVariant,
  Cart,
  Address,
  Wishlist,
  CustomerAccount,
  PincodeHistory
};