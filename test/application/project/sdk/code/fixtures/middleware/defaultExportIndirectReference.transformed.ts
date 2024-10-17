import { withCroct } from "@croct/plug-next/middleware";
const anything = function (request) {
    console.log(request.url);
}

const something = withCroct(anything);

export default something;
