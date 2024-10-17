import { withCroct } from "@croct/plug-next/middleware";
export const config = {
}

export const middleware = withCroct(function(request) {
    console.log(request.url);
});
