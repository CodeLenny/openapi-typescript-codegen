import fetch from 'node-fetch';
import { cleanup } from './scripts/cleanup';
import { compileWithTypescript } from './scripts/compileWithTypescript';
import { generateClient } from './scripts/generateClient';
import server from './scripts/server';

describe('client.node', () => {
    beforeAll(async () => {
        cleanup('client/node');
        await generateClient('client/node', 'v3', 'node', false, false, 'ApiClient');
        compileWithTypescript('client/node');
        await server.start('client/node');
    }, 30000);

    afterAll(async () => {
        await server.stop();
    });

    it('requests token', async () => {
        const { ApiClient } = require('./generated/client/node/index.js');
        const tokenRequest = jest.fn().mockResolvedValue('MY_TOKEN');
        const client = new ApiClient({
            TOKEN: tokenRequest,
            USERNAME: undefined,
            PASSWORD: undefined,
        });
        const result = await client.simple.getCallWithoutParametersAndResponse();
        expect(tokenRequest.mock.calls.length).toBe(1);
        expect(result.headers.authorization).toBe('Bearer MY_TOKEN');
    });

    it('can return an Either', async () => {
        const { ApiClient } = require('./generated/client/node/index.js');
        const tokenRequest = jest.fn().mockResolvedValue('MY_TOKEN');
        const client = new ApiClient({
            TOKEN: tokenRequest,
            USERNAME: undefined,
            PASSWORD: undefined,
        });
        const resultEither = await client.simple.getCallWithoutParametersAndResponseEither();
        expect(resultEither._tag).toBe('Right');
        const result = resultEither.right;
        expect(tokenRequest.mock.calls.length).toBe(1);
        expect(result.headers.authorization).toBe('Bearer MY_TOKEN');
    });

    it('uses credentials', async () => {
        const { ApiClient } = require('./generated/client/node/index.js');
        const client = new ApiClient({
            TOKEN: undefined,
            USERNAME: 'username',
            PASSWORD: 'password',
        });
        const result = await client.simple.getCallWithoutParametersAndResponse();
        expect(result.headers.authorization).toBe('Basic dXNlcm5hbWU6cGFzc3dvcmQ=');
    });

    it('supports complex params', async () => {
        const { ApiClient } = require('./generated/client/node/index.js');
        const client = new ApiClient();
        const result = await client.complex.complexTypes({
            first: {
                second: {
                    third: 'Hello World!',
                },
            },
        });
        expect(result).toBeDefined();
    });

    it('support form data', async () => {
        const { ApiClient } = require('./generated/client/node/index.js');
        const client = new ApiClient();
        const result = await client.parameters.callWithParameters(
            'valueHeader',
            'valueQuery',
            'valueForm',
            'valueCookie',
            'valuePath',
            {
                prop: 'valueBody',
            }
        );
        expect(result).toBeDefined();
    });

    it('can abort the request', async () => {
        let error;
        try {
            const { ApiClient } = require('./generated/client/node/index.js');
            const client = new ApiClient();
            const promise = client.simple.getCallWithoutParametersAndResponse();
            setTimeout(() => {
                promise.cancel();
            }, 10);
            await promise;
        } catch (e) {
            error = (e as Error).message;
        }
        expect(error).toContain('Request aborted');
    });

    it('should throw known error (500)', async () => {
        let error;
        try {
            const { ApiClient } = require('./generated/client/node/index.js');
            const client = new ApiClient();
            await client.error.testErrorCode(500);
        } catch (e) {
            const err = e as any;
            error = JSON.stringify({
                name: err.name,
                message: err.message,
                url: err.url,
                status: err.status,
                statusText: err.statusText,
                body: err.body,
            });
        }
        expect(error).toBe(
            JSON.stringify({
                name: 'ApiError',
                message: 'Custom message: Internal Server Error',
                url: 'http://localhost:3000/base/api/v1.0/error?status=500',
                status: 500,
                statusText: 'Internal Server Error',
                body: {
                    status: 500,
                    message: 'hello world',
                },
            })
        );
    });

    it('can return errors as Either', async () => {
        const { ApiClient } = require('./generated/client/node/index.js');
        const client = new ApiClient();
        const result = await client.error.testErrorCodeEither(500);
        expect(result._tag).toBe('Left');
        expect(result.left.name).toBe('ApiError');
        expect(result.left.body.message).toBe('hello world');
    });

    it('should throw unknown error (409)', async () => {
        let error;
        try {
            const { ApiClient } = require('./generated/client/node/index.js');
            const client = new ApiClient();
            await client.error.testErrorCode(409);
        } catch (e) {
            const err = e as any;
            error = JSON.stringify({
                name: err.name,
                message: err.message,
                url: err.url,
                status: err.status,
                statusText: err.statusText,
                body: err.body,
            });
        }
        expect(error).toBe(
            JSON.stringify({
                name: 'ApiError',
                message: 'Generic Error',
                url: 'http://localhost:3000/base/api/v1.0/error?status=409',
                status: 409,
                statusText: 'Conflict',
                body: {
                    status: 409,
                    message: 'hello world',
                },
            })
        );
    });

    it('can override fetch', async () => {
        const tokenRequest = jest.fn().mockResolvedValue('MY_TOKEN');
        const { ApiClient, BaseHttpRequest } = require('./generated/client/node/index.js');
        const { request } = require('./generated/client/node/core/request');
        const customFetch = jest.fn().mockImplementation((url, init) => fetch(url, init));
        class MockHttpRequest extends BaseHttpRequest {
            constructor(config) {
                super(config);
            }

            public request<T>(options) {
                return request(this.config, options, customFetch);
            }
        }
        const client = new ApiClient(
            {
                TOKEN: tokenRequest,
                USERNAME: undefined,
                PASSWORD: undefined,
            },
            MockHttpRequest
        );
        const result = await client.simple.getCallWithoutParametersAndResponse();
        expect(tokenRequest.mock.calls.length).toBe(1);
        expect(customFetch.mock.calls.length).toBe(1);
        expect(result.headers.authorization).toBe('Bearer MY_TOKEN');
    });
});
