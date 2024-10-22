import {CroctProvider} from "@croct/plug-react";

const UnrelatedComponent = ({Component, pageProps}) => {
    return <Component {...pageProps} />;
}

export const App = ({Component, pageProps}) => (
    <CroctProvider>
        <Component {...pageProps} />
    </CroctProvider>
);
