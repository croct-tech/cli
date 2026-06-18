import {Analytics} from '@shopify/hydrogen';
import {CroctProvider} from '@croct/plug-react';

export default function App({data}) {
    return <Analytics.Provider cart={data.cart} shop={data.shop} consent={data.consent}>
        <CroctProvider>
            <PageLayout {...data}>
                <Outlet />
            </PageLayout>
        </CroctProvider>
    </Analytics.Provider>;
}
