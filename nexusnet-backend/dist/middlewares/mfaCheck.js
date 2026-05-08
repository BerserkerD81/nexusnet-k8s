"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mfaRequired = mfaRequired;
function mfaRequired(req, res, next) {
    if (!req.user?.mfaEnabled) {
        res.status(403).json({ success: false, data: null, message: 'MFA required' });
        return;
    }
    next();
}
