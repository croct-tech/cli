import type {AppProps} from "next/app";
import {ReactElement} from "react";
import {CroctProvider} from "@croct/plug-react";

export default function App({Component, pageProps}: AppProps): ReactElement {
    return (
        <CroctProvider>
            <Component {...pageProps} />;
        </CroctProvider>
    );
}
