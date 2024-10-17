import { withCroct } from "@croct/plug-next/middleware";

export default withCroct(function() {
    console.log('middleware');
});
