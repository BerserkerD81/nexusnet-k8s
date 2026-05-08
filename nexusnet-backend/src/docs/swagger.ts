import swaggerJSDoc from 'swagger-jsdoc';

export function buildSwaggerSpec() {
  return swaggerJSDoc({
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
