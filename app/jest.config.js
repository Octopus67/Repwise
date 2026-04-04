/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '@sentry/react-native': '<rootDir>/__mocks__/@sentry/react-native.ts',
    'react-native-purchases': '<rootDir>/__mocks__/react-native-purchases.ts',
    'react-native-mmkv': '<rootDir>/__mocks__/react-native-mmkv.ts',
    '@react-native-community/netinfo': '<rootDir>/__mocks__/@react-native-community/netinfo.ts',
  },
};
