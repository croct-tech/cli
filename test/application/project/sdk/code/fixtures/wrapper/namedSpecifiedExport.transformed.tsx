import { CroctProvider } from "@croct/plug-react";
const Layout = ({children}) => {
    return (
        <CroctProvider>
            <>
                <main>
                    {children}
                </main>
            </>
        </CroctProvider>
    );
}

const Reference = Layout;

export { Reference as Layout };
