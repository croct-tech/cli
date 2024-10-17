import { CroctProvider } from "@croct/plug-react";
export default function Layout({children}) {
    return (
        <CroctProvider appId={process.env.REACT_APP_CROCT_APP_ID}>
            <>
                <main>{children}</main>
            </>
        </CroctProvider>
    );
}
