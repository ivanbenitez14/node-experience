import { controller, httpGet, httpPost, httpPut, request, response } from 'inversify-express-utils';
import { Response } from 'express';

import ExpressResponder from '../../../Shared/Application/Http/ExpressResponder';

import AuthorizeExpressMiddleware from '../Middlewares/AuthorizeExpressMiddleware';
import Permissions from '../../../Config/Permissions';

import AuthRequest from '../Requests/Auth/AuthRequest';
import ForgotPasswordRequest from '../Requests/Auth/ForgotPasswordRequest';
import ChangeForgotPasswordRequest from '../Requests/Auth/ChangeForgotPasswordRequest';
import RefreshTokenRequest from '../Requests/Auth/RefreshTokenRequest';

import AuthTransformer from '../Transformers/AuthTransformer';
import PermissionsTransformer from '../Transformers/PermissionsTransformer';

import AuthController from '../Controllers/AuthController';
import { AuthUser } from '../Helpers/AuthUser';
import UserTransformer from '../Transformers/UserTransformer';
import dayjs from 'dayjs';
import DefaultTransformer from '../../../Shared/Presentation/Transformers/DefaultTransformer';
import RegisterRequest from '../Requests/Auth/RegisterRequest';
import UpdateMeRequest from '../Requests/Auth/UpdateMeRequest';
import VerifyYourAccountRequest from '../Requests/Auth/VerifyYourAccountRequest';
import RefreshTokenExpressMiddleware from '../Middlewares/RefreshTokenExpressMiddleware';
import MainConfig from '../../../Config/MainConfig';
import StatusCode from '../../../Shared/Application/StatusCode';

@controller('/api/auth')
class AuthExpressHandler
{
    private responder: ExpressResponder;
    private controller: AuthController;

    constructor()
    {
        this.responder = new ExpressResponder();
        this.controller = new AuthController();
    }

    @httpGet('/me')
    public async me(@request() req: any, @response() res: Response): Promise<void>
    {
        void await this.responder.send(AuthUser(req), null, res, StatusCode.HTTP_OK, new UserTransformer());
    }

    @httpPut('/me')
    public async updateMe(@request() req: any, @response() res: Response): Promise<void>
    {
        const data = {
            authUser: AuthUser(req),
            ...req.body
        };

        const _request = new UpdateMeRequest(data);
        const payload = await this.controller.updateMe(_request);

        void await this.responder.send(payload, req, res, StatusCode.HTTP_OK, new UserTransformer());
    }

    @httpPost('/login')
    public async login(@request() req: any, @response() res: Response): Promise<void>
    {
        const _request = new AuthRequest(req.body);

        const payload = await this.controller.login(_request);

        res.cookie(
            'refreshToken',
            payload.getRefreshHash(),
            {
                expires: dayjs.unix(payload.getExpires()).toDate(),
                maxAge: payload.getExpires(),
                path: '/api/auth',
                secure: MainConfig.getInstance().getConfig().setCookieSecure,
                httpOnly: true,
                sameSite: MainConfig.getInstance().getConfig().setCookieSameSite as any
            });

        void await this.responder.send(payload, req, res, StatusCode.HTTP_CREATED, new AuthTransformer());
    }

    @httpPost('/signup')
    public async register(@request() req: any, @response() res: Response): Promise<void>
    {
        const _request = new RegisterRequest(req.body);

        const payload = await this.controller.register(_request);

        void await this.responder.send(payload, req, res, StatusCode.HTTP_CREATED, new DefaultTransformer());
    }

    @httpPost('/logout')
    public async logout(@request() req: any, @response() res: Response)
    {
        const data = {
            refreshToken: req.refreshToken,
            decodeToken: AuthUser(req, 'decodeToken')
        };

        const _request = new RefreshTokenRequest(data);

        const payload = await this.controller.logout(_request);

        res.cookie(
            'refreshToken',
            null,
            {
                expires: dayjs.unix(0).toDate(),
                maxAge: 0,
                path: '/api/auth',
                secure: MainConfig.getInstance().getConfig().setCookieSecure,
                httpOnly: true,
                sameSite: MainConfig.getInstance().getConfig().setCookieSameSite as any
            });

        void await this.responder.send(payload, req, res, StatusCode.HTTP_CREATED, new DefaultTransformer());
    }

    @httpPost('/refresh-token', void RefreshTokenExpressMiddleware)
    public async refreshToken(@request() req: any, @response() res: Response)
    {
        const _request = new RefreshTokenRequest(req);

        const payload = await this.controller.refreshToken(_request);

        res.cookie(
            'refreshToken',
            payload.getRefreshHash(),
            {
                expires: dayjs.unix(payload.getExpires()).toDate(),
                maxAge: payload.getExpires(),
                path: '/api/auth',
                secure: MainConfig.getInstance().getConfig().setCookieSecure,
                httpOnly: true,
                sameSite: MainConfig.getInstance().getConfig().setCookieSameSite as any
            });

        void await this.responder.send(payload, req, res, StatusCode.HTTP_CREATED, new AuthTransformer());
    }

    @httpPost('/forgot-password')
    public async forgotPassword(@request() req: any, @response() res: Response)
    {
        const _request = new ForgotPasswordRequest(req.body);

        const payload = await this.controller.forgotPassword(_request);

        void await this.responder.send(payload, req, res, StatusCode.HTTP_CREATED, null);
    }

    @httpPost('/change-forgot-password')
    public async changeForgotPassword(@request() req: any, @response() res: Response)
    {
        const _request = new ChangeForgotPasswordRequest(req.body);

        const payload = await this.controller.changeForgotPassword(_request);

        void await this.responder.send(payload, req, res, StatusCode.HTTP_CREATED, null);
    }

    @httpPut('/verify-your-account/:confirmationToken')
    public async verifyYourAccount(@request() req: any, @response() res: Response)
    {
        const _request = new VerifyYourAccountRequest(req.params.confirmationToken);

        const payload = await this.controller.verifyYourAccount(_request);

        void await this.responder.send(payload, req, res, StatusCode.HTTP_CREATED, new DefaultTransformer());
    }

    @httpGet('/permissions', void AuthorizeExpressMiddleware(Permissions.GET_PERMISSIONS))
    public async permissions(@request() req: any, @response() res: Response)
    {
        const payload = this.controller.permissions();

        void await this.responder.send(payload, req, res, StatusCode.HTTP_OK, new PermissionsTransformer());
    }

    @httpPost('/sync-roles-permissions', void AuthorizeExpressMiddleware(Permissions.AUTH_SYNC_PERMISSIONS))
    public async syncRolesPermissions(@request() req: any, @response() res: Response)
    {
        await this.controller.syncRolesPermissions();

        void await this.responder.send({ message: 'Sync Successfully' }, req, res, StatusCode.HTTP_CREATED, null);
    }
}
