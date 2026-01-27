import { withCroct } from "@croct/plug-next/proxy";

export function proxy() {
    console.log('proxy');
}

export const config = {
    matcher: '.*'
};
