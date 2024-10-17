import { CroctProvider } from "@croct/plug-react";
export default function Layout({children}) {
    return (<>
        <main>
            <CroctProvider>
                {children}
            </CroctProvider>
        </main>
    </>);
}
