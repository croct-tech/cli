import { CroctProvider } from "@croct/plug-react";
const UnrelatedComponent = ({Component, pageProps}) => {
    return <Component {...pageProps} />;
}

export const App = function ({Component, pageProps}) {
    return (
        <CroctProvider>
            <Component {...pageProps} />
        </CroctProvider>
    );
}
