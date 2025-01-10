import type { NextRequest } from 'next/server';
export declare const config: {
    matcher: string[];
};
export declare function middleware(request: NextRequest): void;
