export default function App({Component, pageProps}) {
    return <div>
        <section>
            <Component {...pageProps} />
        </section>
    </div>;
}
