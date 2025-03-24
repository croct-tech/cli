import { withCroct, matcher } from "@croct/plug-next/middleware";

export function middleware() {
    console.log('middleware');
}

export const config = {
    matcher: '.*'
};
