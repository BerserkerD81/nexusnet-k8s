"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSwaggerSpec = buildSwaggerSpec;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
function buildSwaggerSpec() {
    return (0, swagger_jsdoc_1.default)({
        definition: {
            openapi: '3.0.0',
            info: {
                title: 'NexusNet API',
                version: '1.0.0'
            },
            servers: [{ url: '/api/v1' }]
        },
        apis: []
    });
}
