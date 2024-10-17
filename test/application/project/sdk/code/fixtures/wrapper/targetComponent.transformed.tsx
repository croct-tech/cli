import { CroctProvider } from "@croct/plug-react";
export default function App({Component, pageProps}) {
    return (
        <div>
            <section>
                <CroctProvider>
                    <Component {...pageProps} />
                </CroctProvider>
            </section>
        </div>
    );
}
