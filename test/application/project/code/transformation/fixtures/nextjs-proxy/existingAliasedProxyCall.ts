import { proxy } from "@croct/plug-next/proxy";

export default proxy(function () {
    console.log('proxy');
});
