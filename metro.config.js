const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add .mjs extension to resolver source extensions
config.resolver.sourceExts.push('mjs');

// Prefer browser and main fields to avoid ESM-related issues in node_modules
config.resolver.resolverMainFields = ['browser', 'main'];

// Disable package exports as it was causing issues with socket.io-parser
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
