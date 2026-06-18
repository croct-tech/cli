import type {MiddlewareFunction} from 'react-router';
import {logger} from './middleware/logger';

export const middleware: MiddlewareFunction[] = [logger()];
