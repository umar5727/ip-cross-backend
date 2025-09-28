const Referral = require('./referral.model');
const Offer = require('./offer.model');

// Import Customer model for associations
const Customer = require('../customer/customer.model');

// Define associations
Referral.belongsTo(Customer, {
  foreignKey: 'customer_id',
  as: 'customer'
});

Customer.hasMany(Referral, {
  foreignKey: 'customer_id',
  as: 'referrals'
});

module.exports = {
  Referral,
  Offer
};