-- MCP Writing System Database Initialization
-- This file initializes the PostgreSQL database for the MCP Writing Servers

-- Create database if it doesn't exist (handled by POSTGRES_DB env var)
-- The database will be created automatically by the postgres container

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schema for MCP data
CREATE SCHEMA IF NOT EXISTS mcp;

-- Set search path
SET search_path TO mcp, public;

-- Grant necessary permissions
-- The POSTGRES_USER will have full access to the database

-- Log successful initialization
DO $$
BEGIN
  RAISE NOTICE 'MCP Writing System database initialized successfully';
END
$$;
