import {Analytics} from '@shopify/hydrogen';

export function Layout({children}) {
    const data = useRouteLoaderData('root');

    return <html>
        <body>
            {data ? (
                <Analytics.Provider cart={data.cart} shop={data.shop} consent={data.consent}>
                    <PageLayout {...data}>{children}</PageLayout>
                </Analytics.Provider>
            ) : (
                children
            )}
        </body>
    </html>;
}

export default function App() {
    return <Outlet />;
}
