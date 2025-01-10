import { matcher } from "@croct/plug-next/middleware";
export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)', matcher],
};
export default function () {
    console.log('middleware');
}
