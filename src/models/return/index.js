const Return = require('./return.model');
const ReturnImage = require('./return_image.model');
const ReturnReason = require('./return_reason.model');
const ReturnStatus = require('./return_status.model');

// Define relationships
Return.hasMany(ReturnImage, { 
  foreignKey: 'return_id',
  as: 'ReturnImages'
});
ReturnImage.belongsTo(Return, { 
  foreignKey: 'return_id',
  as: 'Return'
});

Return.belongsTo(ReturnReason, { 
  foreignKey: 'return_reason_id',
  as: 'ReturnReason'
});
ReturnReason.hasMany(Return, { 
  foreignKey: 'return_reason_id',
  as: 'Returns'
});

Return.belongsTo(ReturnStatus, { 
  foreignKey: 'return_status_id',
  as: 'ReturnStatus'
});
ReturnStatus.hasMany(Return, { 
  foreignKey: 'return_status_id',
  as: 'Returns'
});

module.exports = {
  Return,
  ReturnImage,
  ReturnReason,
  ReturnStatus
};
