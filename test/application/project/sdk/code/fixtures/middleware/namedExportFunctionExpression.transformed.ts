import { withCroct } from "@croct/plug-next/middleware";
export const middleware = withCroct(function() {
    console.log('middleware');
})
