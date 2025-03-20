import {ApiKey} from '@/application/model/application';
import {ApplicationPath} from '@/application/api/workspace';

export type NewApiKey = ApplicationPath & Omit<ApiKey, 'id'>;

export type GeneratedApiKey = ApiKey & {
    secret: string,
};

export interface ApplicationApi {
    createApiKey(key: NewApiKey): Promise<GeneratedApiKey>;
}
