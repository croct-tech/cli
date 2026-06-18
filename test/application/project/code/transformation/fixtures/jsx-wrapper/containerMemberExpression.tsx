import {Analytics} from '@shopify/hydrogen';

export default function App({data}) {
    return <Analytics.Provider cart={data.cart} shop={data.shop} consent={data.consent}>
        <PageLayout {...data}>
            <Outlet />
        </PageLayout>
    </Analytics.Provider>;
}
