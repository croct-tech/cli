import { withCroct } from "@croct/plug-next/middleware";

export default withCroct(function anything(request) {
    console.log(request.url);
});
