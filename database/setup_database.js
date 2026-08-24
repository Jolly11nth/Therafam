#!/usr/bin/env node

/**
 * =============================================================================
 * THERAFAM DATABASE SETUP SCRIPT
 * =============================================================================
 * 
 * This script sets up the complete Therafam database schema including:
 * - All tables for users, therapists, sessions, AI chat, mood tracking, etc.
 * - Indexes for optimal performance
 * - Functions for common operations
 * - Sample data for development
 * 
 * Usage:
 *   node setup_database.js [environment]
 * 
 * Examples:
 *   node setup_database.js development
 *   node setup_database.js production
 *   node setup_database.js test
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`)
};

// Get environment from command line argument
const environment = process.argv[2] || 'development';

// Database configuration based on environment
const getDbConfig = (env) => {
  const base = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'therafam_db'
  };

  switch (env) {
    case 'production':
      return {
        ...base,
        ssl: { rejectUnauthorized: false },
        database: process.env.DB_NAME || 'therafam_production'
      };
    case 'test':
      return {
        ...base,
        database: process.env.DB_NAME || 'therafam_test'
      };
    default: // development
      return {
        ...base,
        database: process.env.DB_NAME || 'therafam_development'
      };
  }
};

// Read SQL schema file
const readSchemaFile = () => {
  const schemaPath = path.join(__dirname, 'therafam_schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }
  
  return fs.readFileSync(schemaPath, 'utf8');
};

// Execute SQL with better error handling
const executeSql = async (client, sql, description) => {
  try {
    log.info(`Executing: ${description}`);
    await client.query(sql);
    log.success(`Completed: ${description}`);
  } catch (error) {
    log.error(`Failed: ${description}`);
    log.error(`Error: ${error.message}`);
    throw error;
  }
};

// Check if database exists
const databaseExists = async (config) => {
  const checkClient = new Client({
    ...config,
    database: 'postgres' // Connect to default postgres database
  });
  
  try {
    await checkClient.connect();
    const result = await checkClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [config.database]
    );
    await checkClient.end();
    return result.rows.length > 0;
  } catch (error) {
    await checkClient.end();
    throw error;
  }
};

// Create database if it doesn't exist
const createDatabase = async (config) => {
  const createClient = new Client({
    ...config,
    database: 'postgres' // Connect to default postgres database
  });
  
  try {
    await createClient.connect();
    await createClient.query(`CREATE DATABASE "${config.database}"`);
    await createClient.end();
    log.success(`Database "${config.database}" created`);
  } catch (error) {
    await createClient.end();
    if (error.code === '42P04') { // Database already exists
      log.warning(`Database "${config.database}" already exists`);
    } else {
      throw error;
    }
  }
};

// Verify required extensions
const verifyExtensions = async (client) => {
  log.info('Checking required PostgreSQL extensions...');
  
  const extensions = ['uuid-ossp', 'pgcrypto', 'vector'];
  
  for (const extension of extensions) {
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS "${extension}"`);
      log.success(`Extension "${extension}" verified`);
    } catch (error) {
      log.error(`Failed to install extension "${extension}": ${error.message}`);
      
      if (extension === 'vector') {
        log.warning('pgvector extension is required for AI functionality');
        log.info('Install it with: sudo apt-get install postgresql-14-pgvector');
        log.info('Or see: https://github.com/pgvector/pgvector#installation');
      }
      
      throw error;
    }
  }
};

// Check tables exist and count them
const verifyTables = async (client) => {
  const result = await client.query(`
    SELECT COUNT(*) as table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
  `);
  
  const tableCount = parseInt(result.rows[0].table_count);
  log.success(`Database contains ${tableCount} tables`);
  
  if (tableCount === 0) {
    log.warning('No tables found. Schema may not have been applied correctly.');
  }
  
  return tableCount;
};

// Verify sample data
const verifySampleData = async (client) => {
  try {
    const userResult = await client.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(userResult.rows[0].count);
    
    if (userCount > 0) {
      log.success(`Found ${userCount} sample users`);
    } else {
      log.warning('No sample users found');
    }
  } catch (error) {
    log.warning('Could not verify sample data');
  }
};

// Main setup function
const setupDatabase = async () => {
  log.header(`🌱 SETTING UP THERAFAM DATABASE (${environment.toUpperCase()}) 🌱`);
  
  const config = getDbConfig(environment);
  
  log.info(`Connecting to: ${config.host}:${config.port}`);
  log.info(`Database: ${config.database}`);
  log.info(`User: ${config.user}`);
  
  try {
    // Check if database exists, create if not
    const exists = await databaseExists(config);
    if (!exists) {
      log.info(`Database "${config.database}" does not exist. Creating...`);
      await createDatabase(config);
    } else {
      log.success(`Database "${config.database}" exists`);
    }
    
    // Connect to the target database
    const client = new Client(config);
    await client.connect();
    log.success('Connected to database');
    
    // Verify extensions
    await verifyExtensions(client);
    
    // Read and execute schema
    log.info('Reading schema file...');
    const schema = readSchemaFile();
    log.success('Schema file loaded successfully');
    
    // Execute schema (this will handle the cleanup and recreation)
    await executeSql(client, schema, 'Complete database schema');
    
    // Verify setup
    log.header('🔍 VERIFYING DATABASE SETUP');
    
    const tableCount = await verifyTables(client);
    await verifySampleData(client);
    
    // Close connection
    await client.end();
    log.success('Database connection closed');
    
    // Final success message
    log.header('🎉 DATABASE SETUP COMPLETE! 🎉');
    log.success('Therafam database is ready for use');
    log.info(`Environment: ${environment}`);
    log.info(`Tables created: ${tableCount}`);
    log.info('Next steps:');
    log.info('1. Update your application configuration');
    log.info('2. Start your Therafam application');
    log.info('3. Test the authentication and core features');
    
  } catch (error) {
    log.error('Database setup failed!');
    log.error(error.message);
    
    if (error.code) {
      log.error(`Error code: ${error.code}`);
    }
    
    log.info('\nTroubleshooting tips:');
    log.info('1. Check your database connection settings');
    log.info('2. Ensure PostgreSQL is running');
    log.info('3. Verify database user has necessary permissions');
    log.info('4. Check if required extensions are installed');
    
    process.exit(1);
  }
};

// Run setup if this script is executed directly
if (require.main === module) {
  setupDatabase().catch(error => {
    log.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = {
  setupDatabase,
  getDbConfig,
  databaseExists,
  createDatabase
};
