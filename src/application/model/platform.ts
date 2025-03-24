export enum Platform {
    NEXTJS = 'nextjs',
    REACT = 'react',
    JAVASCRIPT = 'javascript',
}

export namespace Platform {
    export function getName(platform: Platform): string {
        switch (platform) {
            case Platform.NEXTJS:
                return 'Next.js';

            case Platform.REACT:
                return 'React';

            case Platform.JAVASCRIPT:
                return 'JavaScript';
        }
    }
}
