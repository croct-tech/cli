// @ts-check

module.exports = async (phase, { defaultConfig }) => {
    /**
     * @type {import('next').NextConfig}
     */
    const nextConfig = {
        i18n: {
            locales: ['en', 'pt'],
            defaultLocale: 'en',
        }
    }
    return nextConfig
}
