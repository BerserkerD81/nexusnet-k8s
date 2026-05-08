"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passport = void 0;
const passport_1 = __importDefault(require("passport"));
exports.passport = passport_1.default;
const passport_github2_1 = require("passport-github2");
const passport_google_oauth20_1 = require("passport-google-oauth20");
const env_1 = require("./env");
const oauth_service_1 = require("../modules/auth/oauth.service");
const oauthService = new oauth_service_1.OAuthService();
passport_1.default.serializeUser((user, done) => done(null, user));
passport_1.default.deserializeUser((user, done) => done(null, user));
function extractPrimaryEmail(profile) {
    return profile.emails?.find((e) => Boolean(e.value))?.value ?? null;
}
// ─── GitHub ──────────────────────────────────────────────────────────────────
if (env_1.env.GITHUB_CLIENT_ID && env_1.env.GITHUB_CLIENT_SECRET) {
    passport_1.default.use(new passport_github2_1.Strategy({
        clientID: env_1.env.GITHUB_CLIENT_ID,
        clientSecret: env_1.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${env_1.env.OAUTH_CALLBACK_BASE_URL}/api/v1/auth/oauth/github/callback`,
        scope: ['user:email']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const primaryEmail = extractPrimaryEmail(profile);
            const tokens = await oauthService.handleOAuthLogin({
                provider: 'GITHUB',
                providerAccountId: profile.id,
                email: primaryEmail,
                displayName: profile.displayName || profile.username || 'GitHub User',
                username: profile.username ?? undefined,
                avatarUrl: profile.photos?.[0]?.value ?? undefined,
                accessToken,
                refreshToken
            });
            // tokens.user → req.user (AuthUser)
            // resto       → req.authInfo
            const { user, ...authInfo } = tokens;
            return done(null, user, authInfo);
        }
        catch (err) {
            return done(err);
        }
    }));
}
// ─── Google ──────────────────────────────────────────────────────────────────
if (env_1.env.GOOGLE_CLIENT_ID && env_1.env.GOOGLE_CLIENT_SECRET) {
    passport_1.default.use(new passport_google_oauth20_1.Strategy({
        clientID: env_1.env.GOOGLE_CLIENT_ID,
        clientSecret: env_1.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${env_1.env.OAUTH_CALLBACK_BASE_URL}/api/v1/auth/oauth/google/callback`,
        scope: ['profile', 'email']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const primaryEmail = extractPrimaryEmail(profile);
            const tokens = await oauthService.handleOAuthLogin({
                provider: 'GOOGLE',
                providerAccountId: profile.id,
                email: primaryEmail,
                displayName: profile.displayName || 'Google User',
                avatarUrl: profile.photos?.[0]?.value ?? undefined,
                accessToken,
                refreshToken
            });
            const { user, ...authInfo } = tokens;
            return done(null, user, authInfo);
        }
        catch (err) {
            return done(err);
        }
    }));
}
