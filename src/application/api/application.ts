import {ApiKey} from '@/application/model/application';

export type NewApiKey = Omit<ApiKey, 'id'> & {
    applicationId: string,
};

export type GeneratedApiKey = ApiKey & {
    secret: string,
};

export interface ApplicationApi {
    createApiKey(key: NewApiKey): Promise<GeneratedApiKey>;
}
