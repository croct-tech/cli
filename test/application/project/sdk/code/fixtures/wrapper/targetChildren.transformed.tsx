import { CroctProvider } from "@croct/plug-react";
export default function Layout({children}) {
    return (<>
        {/* This is a comment */}
        <main>
            <CroctProvider>
                {children}
            </CroctProvider>
        </main>
    </>);
}
