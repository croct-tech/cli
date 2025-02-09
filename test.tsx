
import {LazyPromise} from "./src/infrastructure/promise";
import {RunOptionsValidator} from "./src/infrastructure/application/validation/actions/runOptionsValidator";

(async () => {

    const validator = new RunOptionsValidator();

    console.log((await validator.validate({
        actions: [Promise.resolve({
            name: Promise.resolve('foo'),
            condition: LazyPromise.transient(() => true),
            actions: LazyPromise.transient(() => true),
        })]

    })).data)
})();
