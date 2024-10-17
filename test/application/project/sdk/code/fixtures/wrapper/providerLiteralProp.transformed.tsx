import { CroctProvider } from "@croct/plug-react";
export default function Layout({children}) {
    return (
        <CroctProvider booleanProp={true} numberProp={42} stringProp={"value"} nullProp={null}>
            <>
                <main>{children}</main>
            </>
        </CroctProvider>
    );
}
