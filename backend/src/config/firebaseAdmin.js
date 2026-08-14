const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

let firebaseAuth = null;

function readServiceAccount() {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!rawServiceAccount) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
    }

    try {
        return JSON.parse(rawServiceAccount);
    } catch (error) {
        throw new Error(
            `FIREBASE_SERVICE_ACCOUNT is not valid JSON: ${error.message}`
        );
    }
}

function initializeFirebaseAdmin() {
    if (firebaseAuth) {
        return firebaseAuth;
    }

    const serviceAccount = readServiceAccount();

    if (!getApps().length) {
        console.log(
            "[firebaseAdmin] Initializing Firebase Admin",
            serviceAccount.project_id || "<unknown project>"
        );
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
