import type {AppProps} from "next/app";
import {ReactElement} from "react";
import {CroctProvider as Provider} from "@croct/plug-react";

export default function App({Component, pageProps}: AppProps): ReactElement {
    return (
        <Provider>
            <Component {...pageProps} />;
        </Provider>
    );
}
