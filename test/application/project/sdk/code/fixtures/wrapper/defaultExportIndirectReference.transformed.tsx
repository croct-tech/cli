import { CroctProvider } from "@croct/plug-react";
// Block scoped variable, unrelated to the default export
{
    const Layout = () => {
    }

    const Reference = Layout;
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

export default Reference;
