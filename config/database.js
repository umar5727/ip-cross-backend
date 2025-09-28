const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false
  }
);

// Create a connection object with query method for backward compatibility
const connection = {
  query: function(sql, params, callback) {
    // Handle both callback style and promise style
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    
    // If callback is provided, use callback style
    if (typeof callback === 'function') {
      sequelize.query(sql, {
        replacements: Array.isArray(params) ? params : [],
        type: Sequelize.QueryTypes.RAW
      })
      .then(([results, metadata]) => {
        callback(null, results, metadata);
      })
      .catch(error => {
        callback(error);
      });
    } else {
      // Return promise for async/await usage
      return sequelize.query(sql, {
        replacements: Array.isArray(params) ? params : [],
        type: Sequelize.QueryTypes.RAW
      });
    }
  }
};

// Export both Sequelize instance and connection object
module.exports = sequelize;
module.exports.connection = connection;