import {format} from "./src/infrastructure/application/cli/io/formatting";
import {parse} from "@croct/md-lite";


console.log(JSON.stringify(parse('foo \n abc `aa` \n\naa'), null, 2));

console.log(format('foo\nabc `aa`\n\naa'))
