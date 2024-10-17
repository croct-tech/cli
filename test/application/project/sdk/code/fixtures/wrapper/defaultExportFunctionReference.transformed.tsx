import { CroctProvider } from "@croct/plug-react";
function Layout({children}) {
    return <>
        <main>
            <CroctProvider>
                {children}
            </CroctProvider>
        </main>
    </>;
}

export default Layout;
