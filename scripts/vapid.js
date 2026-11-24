// Prints a VAPID key pair for push notifications. Put them in Railway variables.
const k = require('web-push').generateVAPIDKeys();
console.log('VAPID_PUBLIC_KEY=' + k.publicKey);
console.log('VAPID_PRIVATE_KEY=' + k.privateKey);
