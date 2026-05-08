import type { User as PrismaUser } from '@prisma/client';

/**
 * Forma común de `req.user` en toda la app.
 * Coincide con el payload que firmamos en el JWT y con lo que devuelve OAuth.
 */
type AuthUser = Pick<
  PrismaUser,
  'id' | 'email' | 'username' | 'displayName' | 'mfaEnabled'
>;

declare global {
  namespace Express {
    /**
     * Passport (vía @types/passport) declara `interface User {}` y
     * `Request.user?: User`. Al extenderla aquí, AUTOMÁTICAMENTE
     * `req.user` queda tipado como `AuthUser` en toda la app.
     *
     * No redeclaramos `Request.user` — dejamos que el merge de Passport
     * lo haga por nosotros.
     */
    interface User extends AuthUser {}

    interface Request {
      sessionId?: string;
    }
  }
}

export {};