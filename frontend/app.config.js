module.exports = ({ config }) => {
  const isDev = process.env.APP_ENV === 'development';

  return {
    ...config,
    name: isDev ? `${config.name} (Dev)` : config.name,
    android: {
      ...config.android,
      package: isDev ? `${config.android.package}.dev` : config.android.package,
    }
  };
};
