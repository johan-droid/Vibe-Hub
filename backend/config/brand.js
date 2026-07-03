export const SELINA_BRAND = Object.freeze({
  productName: 'Selina',
  agentName: 'Selina Core',
  serviceName: 'selina-server-bridge',
  companyName: 'Selina Intelligence Labs',
  version: '4.1.0',
  architecture: 'v6',
  languageLock: ['en', 'hi', 'or'],
  sandbox: {
    type: 'local_docker',
    label: 'Local Docker container',
    network: 'none',
  },
});

export default SELINA_BRAND;
