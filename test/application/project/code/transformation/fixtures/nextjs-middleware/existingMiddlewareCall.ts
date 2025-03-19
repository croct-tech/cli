import { middleware as croctMiddleware } from "@croct/plug-next/middleware";

export default croctMiddleware(function () {
    console.log('middleware');
});
