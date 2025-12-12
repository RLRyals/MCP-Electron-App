/**
 * Bootstrap file for Electron main process
 * This file exists to work around the electron require() issue
 * where require('electron') returns a string when called from the main entry point
 */

// Load the actual main file
require('./index.js');
