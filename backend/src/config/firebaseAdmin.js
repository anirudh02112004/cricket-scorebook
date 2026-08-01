const admin = require("firebase-admin");

let firebaseAuth = null;

function initializeFirebaseAdmin() {
    if (firebaseAuth) {
        return firebaseAuth;
    }

    const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT
    );

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    }

    firebaseAuth = admin.auth();

    return firebaseAuth;
}

module.exports = {
    initializeFirebaseAdmin,
};