const UnrelatedComponent = ({Component, pageProps}) => {
    return <Component {...pageProps} />;
}

export const App = ({Component, pageProps}) => (
    <Component {...pageProps} />
);
