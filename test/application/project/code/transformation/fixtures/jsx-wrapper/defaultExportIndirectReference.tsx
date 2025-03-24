// Block scoped variable, unrelated to the default export
{
    const Layout = () => {
    }

    const Reference = Layout;
}

const Layout = ({children}) => {
    return <>
        <main>
            {children}
        </main>
    </>;
}

const Reference = Layout;

export default Reference;
