export enum Platform {
    NEXTJS = 'nextjs',
    NUXT = 'nuxt',
    REACT = 'react',
    VUE = 'vue',
    JAVASCRIPT = 'javascript',
}

export namespace Platform {
    export function getName(platform: Platform): string {
        switch (platform) {
            case Platform.NEXTJS:
                return 'Next.js';

            case Platform.NUXT:
                return 'Nuxt';

            case Platform.REACT:
                return 'React';

            case Platform.VUE:
                return 'Vue';

            case Platform.JAVASCRIPT:
                return 'JavaScript';
        }
    }
}
