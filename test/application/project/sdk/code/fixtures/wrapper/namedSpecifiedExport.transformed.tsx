import { CroctProvider } from "@croct/plug-react";
// Block scoped variable, unrelated to the default export
{
    function Layout() {
    }

    const Reference = Layout;
}

function unrelated() {

}

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
