import {Theme} from 'ui';

export default function App({Component, pageProps}) {
    return <div>
        <Theme.Provider>
            <Component {...pageProps} />
        </Theme.Provider>
    </div>;
}
