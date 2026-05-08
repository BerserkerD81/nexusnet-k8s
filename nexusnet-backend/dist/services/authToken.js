"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
function signAccessToken(payload) {
    const options = { expiresIn: env_1.env.JWT_EXPIRES_IN };
    return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_SECRET, options);
}
function signRefreshToken(payload) {
    const options = { expiresIn: '7d' };
    return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_REFRESH_SECRET, options);
}
