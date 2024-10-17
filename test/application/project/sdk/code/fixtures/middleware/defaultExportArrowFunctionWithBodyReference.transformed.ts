import { withCroct } from "@croct/plug-next/middleware";
const anything = withCroct((request) => {
    console.log(request.url);
})

export default anything;
