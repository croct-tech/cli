import { middleware } from "@croct/plug-next/middleware";

export default middleware(function () {
    console.log('middleware');
});
