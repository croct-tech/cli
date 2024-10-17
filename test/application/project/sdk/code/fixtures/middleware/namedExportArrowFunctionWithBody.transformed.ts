import { withCroct } from "@croct/plug-next/middleware";
export const middleware = withCroct(() => {
    console.log('middleware');
})
