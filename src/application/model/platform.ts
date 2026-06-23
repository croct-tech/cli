export enum Platform {
    NEXTJS = 'nextjs',
    NUXT = 'nuxt',
    HYDROGEN = 'hydrogen',
    REACT = 'react',
    VUE = 'vue',
    JAVASCRIPT = 'javascript',
    LARAVEL = 'laravel',
    SYMFONY = 'symfony',
    DRUPAL = 'drupal',
    PHP = 'php',
}

export namespace Platform {
    export function getName(platform: Platform): string {
        switch (platform) {
            case Platform.NEXTJS:
                return 'Next.js';

            case Platform.NUXT:
                return 'Nuxt';

            case Platform.HYDROGEN:
                return 'Hydrogen';

            case Platform.REACT:
                return 'React';

            case Platform.VUE:
                return 'Vue';

            case Platform.JAVASCRIPT:
                return 'JavaScript';

            case Platform.LARAVEL:
                return 'Laravel';

            case Platform.SYMFONY:
                return 'Symfony';

            case Platform.DRUPAL:
                return 'Drupal';

            case Platform.PHP:
                return 'PHP';
        }
    }
}
