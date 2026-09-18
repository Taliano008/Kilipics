import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const isReleaseProfile =
    process.env.EAS_BUILD_PROFILE === 'preview' ||
    process.env.EAS_BUILD_PROFILE === 'production';
    
  const useMockCatalog = process.env.EXPO_PUBLIC_USE_MOCK_CATALOG === 'true';

  if (isReleaseProfile && useMockCatalog) {
    throw new Error(
      '\n\n======================================================\n' +
      '🚨 BUILD FAILED: Mock catalog is enabled!\n' +
      'EXPO_PUBLIC_USE_MOCK_CATALOG cannot be true for ' + process.env.EAS_BUILD_PROFILE + ' builds.\n' +
      'Real users must not see mock data.\n' +
      '======================================================\n'
    );
  }

  return {
    ...config,
    name: config.name ?? 'KiliPicks',
    slug: config.slug ?? 'kilipicks-mobile',
  };
};
