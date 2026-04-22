const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add .mjs extension to resolver source extensions
config.resolver.sourceExts.push('mjs');

// Prefer browser and main fields to avoid ESM-related issues in node_modules
config.resolver.resolverMainFields = ['browser', 'main'];

// Disable package exports as it was causing issues with socket.io-parser
config.resolver.unstable_enablePackageExports = false;

// Block react-native-maps from being bundled on web
const originalGetPolyfills = config.serializer.getPolyfills;
config.serializer.getPolyfills = (options) => {
  const polyfills = originalGetPolyfills(options);
  // Don't include any polyfills - let the platform-specific resolution handle it
  return polyfills;
};

// Use platform-specific resolution to handle native-only modules
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // On web, don't resolve react-native-maps, let the .web.tsx file handle it
  if (platform === 'web' && moduleName === 'react-native-maps') {
    // Return a dummy so the require doesn't fail
    return {
      filePath: require.resolve('react-native/Libraries/vendor/emitter/EventEmitter.js'),
      type: 'sourceFile',
    };
  }
  
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
};

module.exports = config;
