import { CroctProvider } from "@croct/plug-react";
const UnrelatedComponent = ({Component, pageProps}) => {
    return <Component {...pageProps} />;
}

export function App({Component, pageProps}) {
    return (
        <CroctProvider>
            <Component {...pageProps} />
        </CroctProvider>
    );
}
