import type { NextRequest } from 'next/server'

export default function proxy(request: NextRequest): void {
    console.log(request.url);
}

export const config = bar;
