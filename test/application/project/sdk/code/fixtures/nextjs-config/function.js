// @ts-check

export default (phase, { defaultConfig }) => {
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
