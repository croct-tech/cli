import { withCroct } from "@croct/plug-next/middleware";

export default withCroct(() => {
    console.log('middleware');
});
