"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const rateLimiters_1 = require("./middlewares/rateLimiters");
const errorHandler_1 = require("./middlewares/errorHandler");
const swagger_1 = require("./docs/swagger");
const auth_routes_1 = require("./modules/auth/auth.routes");
const oauth_routes_1 = require("./modules/auth/oauth.routes");
const passport_1 = require("./config/passport");
const users_routes_1 = require("./modules/users/users.routes");
const posts_routes_1 = require("./modules/posts/posts.routes");
const comments_routes_1 = require("./modules/comments/comments.routes");
const followers_routes_1 = require("./modules/followers/followers.routes");
const messages_routes_1 = require("./modules/messages/messages.routes");
const notifications_routes_1 = require("./modules/notifications/notifications.routes");
const health_routes_1 = require("./health.routes");
function createApp() {
    const app = (0, express_1.default)();
    const swaggerSpec = (0, swagger_1.buildSwaggerSpec)();
    app.set('trust proxy', 1);
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                'connect-src': ["'self'", 'https:', 'wss:']
            }
        }
    }));
    app.use((0, cors_1.default)({ origin: true, credentials: true }));
    app.use((0, compression_1.default)());
    app.use(express_1.default.json({ limit: '1mb' }));
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use(rateLimiters_1.globalRateLimiter);
    // Passport — stateless (session: false), no session middleware needed.
    app.use(passport_1.passport.initialize());
    app.get('/health', health_routes_1.healthRouter.health);
    app.get('/ready', health_routes_1.healthRouter.ready);
    app.get('/metrics', health_routes_1.healthRouter.metrics);
    app.use('/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerSpec));
    app.use('/api/v1/auth', rateLimiters_1.authRateLimiter, auth_routes_1.authRouter);
    app.use('/api/v1/auth/oauth', oauth_routes_1.oauthRouter);
    app.use('/api/v1/users', users_routes_1.usersRouter);
    app.use('/api/v1/posts', posts_routes_1.postsRouter);
    app.use('/api/v1/comments', comments_routes_1.commentsRouter);
    app.use('/api/v1/follow', followers_routes_1.followersRouter);
    app.use('/api/v1/messages', messages_routes_1.messagesRouter);
    app.use('/api/v1/notifications', notifications_routes_1.notificationsRouter);
    app.use(errorHandler_1.notFoundHandler);
    app.use(errorHandler_1.errorHandler);
    return app;
}
