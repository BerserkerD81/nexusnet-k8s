"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authGuard = authGuard;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
function authGuard(req, res, next) {
    const authorization = req.header('authorization');
    if (!authorization?.startsWith('Bearer ')) {
        res.status(401).json({ success: false, data: null, message: 'Unauthorized' });
        return;
    }
    try {
        const token = authorization.slice(7);
        const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        req.user = {
            id: payload.sub,
            email: payload.email,
            username: payload.username,
            displayName: payload.displayName,
            mfaEnabled: payload.mfaEnabled
        };
        next();
    }
    catch {
        res.status(401).json({ success: false, data: null, message: 'Invalid or expired token' });
    }
}
