// Block scoped variable, unrelated to the default export
{
    function Layout() {
    }

    const Reference = Layout;
}

function unrelated() {

}

const Layout = ({children}) => {
    return <>
        <main>
            {children}
        </main>
    </>;
}

const Reference = Layout;

export { Reference as Layout };
