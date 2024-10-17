import { CroctProvider } from "@croct/plug-react";
const Layout = ({children}) => {
    return <>
        <main>
            <CroctProvider>
                {children}
            </CroctProvider>
        </main>
    </>;
}

export default Layout;
