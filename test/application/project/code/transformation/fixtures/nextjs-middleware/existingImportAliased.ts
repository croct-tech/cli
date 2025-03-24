import { withCroct as croctMiddleware, matcher as croctMatcher } from "@croct/plug-next/middleware";

export function middleware() {
    console.log('middleware');
}

export const config = {
    matcher: '.*'
};
