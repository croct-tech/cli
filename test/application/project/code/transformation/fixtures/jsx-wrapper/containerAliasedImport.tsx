import {Analytics as Shopify} from '@shopify/hydrogen';

export default function App({data}) {
    return <Shopify.Provider cart={data.cart} shop={data.shop} consent={data.consent}>
        <PageLayout {...data}>
            <Outlet />
        </PageLayout>
    </Shopify.Provider>;
}
