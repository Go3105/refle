/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    experimental: {
        // ppr: 'incremental'
        ppr: false,
    },
    // Server側の処理でエラーが出るのを防ぐ
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.externals = [
                ...(config.externals || []),
                'bufferutil',
                'utf-8-validate'
            ]
        }
        return config
    },
    // Powered by ヘッダーを無効化
    poweredByHeader: false,
}

module.exports = nextConfig 