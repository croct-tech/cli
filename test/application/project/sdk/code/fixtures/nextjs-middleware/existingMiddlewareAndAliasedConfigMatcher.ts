import { matcher as croctMatcher } from "@croct/plug-next/middleware";

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)', croctMatcher],
}

export default function () {
    console.log('middleware');
}
