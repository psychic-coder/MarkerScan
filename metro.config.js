const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // react-native-reanimated v4 internally imports 'react-native-worklets'
    // but this project uses 'react-native-worklets-core' (required by VisionCamera).
    // Alias the missing package to its installed equivalent.
    extraNodeModules: {
      'react-native-worklets': path.resolve(
        __dirname,
        'node_modules/react-native-worklets-core',
      ),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
