import {logger} from './middleware/logger';

const VERSION = '1';

export const middleware = [logger()];
