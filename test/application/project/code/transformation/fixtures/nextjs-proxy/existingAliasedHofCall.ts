import { withCroct as croctProxy } from "@croct/plug-next/proxy";

export default croctProxy(function () {
    console.log('proxy');
});
