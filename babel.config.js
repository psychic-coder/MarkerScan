// babel.config.js
// Must include the worklets plugin BEFORE the React Native preset
// so that 'worklet' directives are transformed correctly.

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // react-native-worklets-core: enables 'worklet' directive for VisionCamera.
    // NOTE: react-native-reanimated/plugin is intentionally excluded here
    // because reanimated v4 re-exports this same plugin, causing a duplicate error.
    'react-native-worklets-core/plugin',
  ],
};
