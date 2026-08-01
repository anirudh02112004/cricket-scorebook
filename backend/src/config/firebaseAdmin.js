const fs = require("fs");
const path = require("path");
const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

function readServiceAccount() {
    const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (explicitPath && fs.existsSync(explicitPath)) {
        return require(path.resolve(explicitPath));
    }

    const firebaseDir = path.join(__dirname, "..", "..", "firebase");
    const files = fs.existsSync(firebaseDir)
        ? fs.readdirSync(firebaseDir).filter((file) => file.endsWith(".json"))
        : [];

    if (!files.length) {
        throw new Error(
            "Firebase service account JSON not found. Set FIREBASE_SERVICE_ACCOUNT_PATH or place a JSON file in backend/firebase."
        );
    }

    return require(path.join(firebaseDir, files[0]));
}

function initializeFirebaseAdmin() {
    if (!getApps().length) {
        const serviceAccount = readServiceAccount();

        initializeApp({
            credential: cert(serviceAccount)
        });
    }

    return getAuth();
}

module.exports = {
    initializeFirebaseAdmin
};
