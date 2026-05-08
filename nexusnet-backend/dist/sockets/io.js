"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSocketServer = setSocketServer;
exports.getSocketServer = getSocketServer;
let ioRef = null;
function setSocketServer(io) {
    ioRef = io;
}
function getSocketServer() {
    return ioRef;
}
