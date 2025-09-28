const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    dialect: config.dialect,
    logging: false
  }
);

async function runMigrations() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    const sqlScript = fs.readFileSync(
      path.join(__dirname, '../migrations/create_download_tables.sql'),
      'utf8'
    );

    const statements = sqlScript
      .split(';')
      .filter(statement => statement.trim() !== '');

    for (const statement of statements) {
      await sequelize.query(`${statement};`);
    }

    console.log('Download tables migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

runMigrations();