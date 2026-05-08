import passport from 'passport';
import {
  Strategy as GitHubStrategy,
  type Profile as GitHubProfile
} from 'passport-github2';
import {
  Strategy as GoogleStrategy,
  type Profile as GoogleProfile
} from 'passport-google-oauth20';
import type { VerifyCallback } from 'passport-oauth2';
import { env } from '@config/env';
import { OAuthService } from '@modules/auth/oauth.service';

const oauthService = new OAuthService();

passport.serializeUser<Express.User>((user, done) => done(null, user));
passport.deserializeUser<Express.User>((user, done) => done(null, user));

function extractPrimaryEmail(
  profile: GitHubProfile | GoogleProfile
): string | null {
  return profile.emails?.find((e) => Boolean(e.value))?.value ?? null;
}

// ─── GitHub ──────────────────────────────────────────────────────────────────
if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        callbackURL: `${env.OAUTH_CALLBACK_BASE_URL}/api/v1/auth/oauth/github/callback`,
        scope: ['user:email']
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: GitHubProfile,
        done: VerifyCallback
      ) => {
        try {
          const primaryEmail = extractPrimaryEmail(profile);

          const tokens = await oauthService.handleOAuthLogin({
            provider: 'GITHUB',
            providerAccountId: profile.id,
            email: primaryEmail,
            displayName:
              profile.displayName || profile.username || 'GitHub User',
            username: profile.username ?? undefined,
            avatarUrl: profile.photos?.[0]?.value ?? undefined,
            accessToken,
            refreshToken
          });

          // tokens.user → req.user (AuthUser)
          // resto       → req.authInfo
          const { user, ...authInfo } = tokens;
          return done(null, user, authInfo);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}

// ─── Google ──────────────────────────────────────────────────────────────────
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${env.OAUTH_CALLBACK_BASE_URL}/api/v1/auth/oauth/google/callback`,
        scope: ['profile', 'email']
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: GoogleProfile,
        done: VerifyCallback
      ) => {
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
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}

export { passport };