import {CroctProvider as Provider} from "@croct/plug-react";

export default function Layout({children}) {
    return (
        <html lang="en">
            <body>
                {/* This is a comment */}
                {children}
            </body>
        </html>
    );
}
