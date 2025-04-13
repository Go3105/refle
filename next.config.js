/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 最新のTurbopack設定
  turbopack: {
    // モジュール解決の設定
    resolveConfig: {
      // socket.io-clientのパスを明示的に指定
      alias: {
        'socket.io-client': 'socket.io-client',
      },
    },
  },
  // Server側の処理でエラーが出るのを防ぐ
  // Turbopackでもwebpack設定が使用される場合に備えて残す
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.externals = [
        ...(config.externals || []),
        'bufferutil',
        'utf-8-validate'
      ]
    }
    return config
  }
}

module.exports = nextConfig 