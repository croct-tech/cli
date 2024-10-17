import { withCroct } from "@croct/plug-next/middleware";
const anything = withCroct(function (request) {
    console.log(request.url);
})

export default anything;
