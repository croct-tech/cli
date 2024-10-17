import { withCroct } from "@croct/plug-next/middleware";
import type { NextRequest } from 'next/server'

export default withCroct(function middleware(request: NextRequest) {
    console.log(request.url);
});

export const config = bar;
