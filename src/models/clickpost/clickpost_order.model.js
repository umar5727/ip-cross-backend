const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/database');

const ClickPostOrder = sequelize.define('clickpost_order', {
  clickpost_table_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ipshopy_order_id: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  commercial_invoice_url: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  waybill: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  reference_number: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  shipping_charge: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  label_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  courier_partner_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  courier_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  tracking_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  manifest_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  order_status_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  manifest_url: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: ''
  },
  manifest_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  pickup_datetime: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'oc_clickpost_order',
  timestamps: true,
  createdAt: 'date_added',
  updatedAt: 'date_modified'
});

// Static methods for ClickPost operations
ClickPostOrder.getOrderByAwb = async function(awb) {
  return await this.findOne({
    where: { waybill: awb }
  });
};

ClickPostOrder.getOrderById = async function(orderId) {
  return await this.findOne({
    where: { ipshopy_order_id: orderId }
  });
};

ClickPostOrder.updateOrderStatus = async function(orderId, statusId) {
  return await this.update(
    { order_status_id: statusId },
    { where: { ipshopy_order_id: orderId } }
  );
};

ClickPostOrder.getAwbByOrderId = async function(orderId) {
  const order = await this.findOne({
    where: { ipshopy_order_id: orderId },
    attributes: ['waybill', 'courier_partner_id', 'account_code']
  });
  return order ? {
    waybill: order.waybill,
    courier_partner_id: order.courier_partner_id,
    account_code: order.account_code
  } : null;
};

module.exports = ClickPostOrder;
