importScripts('./ngsw-worker.js');

(function() {
  'use strict';

  const logger = {
    logPrefix: '[CustomSW]',
    debug: (...args) => console.debug(logger.logPrefix, ...args)
  };

  // Store original fetch
  const originalFetch = fetch;

  // Override fetch to add logging
  self.fetch = async function(...args) {
    const request = args[0];
    const url = (request instanceof Request) ? request.url : String(request);
    
    logger.debug('Fetch:', {
      url,
      method: request instanceof Request ? request.method : 'GET',
      destination: request instanceof Request ? request.destination : ''
    });

    return originalFetch.apply(this, args);
  };
})();