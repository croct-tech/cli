import {Analytics} from '@shopify/hydrogen';

export default function App() {
    const data = useRouteLoaderData('root');

    if (!data) {
        return <Outlet />;
    }

    return (
        <Analytics.Provider cart={data.cart} shop={data.shop} consent={data.consent}>
            <PageLayout {...data}>
                <Outlet />
            </PageLayout>
        </Analytics.Provider>
    );
}
