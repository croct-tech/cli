export default function App({data}) {
    return <div>
        <PageLayout {...data}>
            <Outlet />
        </PageLayout>
    </div>;
}
