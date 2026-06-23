import {createCroctMiddleware} from '@croct/plug-hydrogen/server';
import {logger} from './middleware/logger';

export const middleware = [logger()];
