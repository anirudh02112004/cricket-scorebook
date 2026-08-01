const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

let firebaseAuth = null;

function initializeFirebaseAdmin() {
    if (firebaseAuth) {
        return firebaseAuth;
    }

    const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT
    );

    if (!getApps().length) {
        initializeApp({
            credential: cert(serviceAccount),
        });
    }

    firebaseAuth = getAuth();

    return firebaseAuth;
}

module.exports = {
    initializeFirebaseAdmin,
};