import { CroctProvider } from "@croct/plug-react";
export default function App({Component, pageProps}) {
    return (
        <CroctProvider>
            <div>
                <section>
                    <Component {...pageProps} />
                </section>
            </div>
        </CroctProvider>
    );
}
