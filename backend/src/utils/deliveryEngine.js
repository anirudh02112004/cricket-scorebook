const NO_BALL_REASON_LABELS = {
    HEIGHT: "Height",
    OVERSTEP: "Overstep",
    SECOND_BOUNCER: "Second Bouncer"
};

const DismissedBatsmanPositions = {
    STRIKER: "STRIKER",
    NON_STRIKER: "NON_STRIKER"
};

function normalizeExtraType(value) {
    const normalized = String(value || "None").replace(/\s+/g, "").toLowerCase();

    if (normalized === "wide") return "Wide";
    if (normalized === "noball") return "NoBall";
    if (normalized === "bye") return "Bye";
    if (normalized === "legbye") return "LegBye";

    return "None";
}

function normalizeNoBallReason(value) {
    const normalized = String(value || "").replace(/[\s_-]+/g, "").toUpperCase();

    if (!normalized) return null;
    if (normalized === "HEIGHT") return "HEIGHT";
    if (normalized === "OVERSTEP") return "OVERSTEP";
    if (normalized === "SECONDBOUNCER") return "SECOND_BOUNCER";

    return null;
}

function displayNoBallReason(value) {
    const normalized = normalizeNoBallReason(value);
    return normalized ? NO_BALL_REASON_LABELS[normalized] : "";
}

function normalizeDismissedBatsmanPosition(value) {
    const normalized = String(value || "").replace(/[\s_-]+/g, "").toUpperCase();

    if (normalized === "STRIKER") return DismissedBatsmanPositions.STRIKER;
    if (normalized === "NONSTRIKER") return DismissedBatsmanPositions.NON_STRIKER;

    return null;
}

function isLegalDelivery(extraType) {
    return extraType !== "Wide" && extraType !== "NoBall";
}

function swapEnds(state) {
    return {
        strikerId: state.nonStrikerId,
        nonStrikerId: state.strikerId
    };
}

function resolveRunOutState({
    strikerId,
    nonStrikerId,
    dismissedBatsmanPosition,
    runsCompleted = 0,
    incomingBatsmanId
}) {
    const normalizedPosition = normalizeDismissedBatsmanPosition(dismissedBatsmanPosition);
    if (!normalizedPosition) {
        throw new Error("dismissedBatsmanPosition must be STRIKER or NON_STRIKER");
    }

    const completedRuns = Number.isFinite(Number(runsCompleted))
        ? Math.max(0, Math.floor(Number(runsCompleted)))
        : 0;

    const dismissedBatsmanId =
        normalizedPosition === DismissedBatsmanPositions.STRIKER
            ? strikerId
            : nonStrikerId;

    const survivingBatsmanId =
        normalizedPosition === DismissedBatsmanPositions.STRIKER
            ? nonStrikerId
            : strikerId;

    const survivingBatsmanEndsAtStriker =
        (normalizedPosition === DismissedBatsmanPositions.STRIKER && completedRuns % 2 === 1) ||
        (normalizedPosition === DismissedBatsmanPositions.NON_STRIKER && completedRuns % 2 === 0);

    let state = {
        strikerId: survivingBatsmanEndsAtStriker ? survivingBatsmanId : null,
        nonStrikerId: survivingBatsmanEndsAtStriker ? null : survivingBatsmanId
    };

    if (incomingBatsmanId) {
        if (survivingBatsmanEndsAtStriker) {
            state.nonStrikerId = incomingBatsmanId;
        } else {
            state.strikerId = incomingBatsmanId;
        }
    }

    return {
        dismissedBatsmanPosition: normalizedPosition,
        dismissedBatsmanId,
        strikerId: state.strikerId,
        nonStrikerId: state.nonStrikerId,
        completedRuns,
        survivingBatsmanId
    };
}

function buildCommentary({
    runsOffBat = 0,
    extraType = "None",
    extraRuns = 0,
    isWicket = false,
    dismissalType = "",
    noBallReason = null,
    dismissedBatsmanName = "",
    dismissedBatsmanPosition = null
}) {
    const normalizedExtraType = normalizeExtraType(extraType);
    const normalizedNoBallReason = normalizeNoBallReason(noBallReason);

    if (isWicket) {
        if (normalizeNoBallReason(noBallReason) === "SECOND_BOUNCER") {
            return "No ball - Second bouncer";
        }

        if (normalizeDismissedBatsmanPosition(dismissedBatsmanPosition) && normalizeExtraType(extraType) === "NoBall") {
            const playerName = dismissedBatsmanName || "Batsman";
            const completedRuns = Number(extraRuns || 0);
            return completedRuns > 0
                ? `${playerName} run out - ${completedRuns} run${completedRuns === 1 ? "" : "s"} completed`
                : `Run out - ${playerName}`;
        }

        if (dismissalType === "Run Out") {
            const playerName = dismissedBatsmanName || "Batsman";
            return `Run out - ${playerName}`;
        }

        if (dismissalType) {
            return `${dismissalType} - Wicket`;
        }
    }

    if (normalizedExtraType === "Wide") return "Wide";
    if (normalizedExtraType === "NoBall" && normalizedNoBallReason) {
        return `No ball - ${displayNoBallReason(normalizedNoBallReason)}`;
    }
    if (normalizedExtraType === "NoBall") return "No ball";
    if (normalizedExtraType === "Bye") return `Bye ${extraRuns}`;
    if (normalizedExtraType === "LegBye") return `Leg bye ${extraRuns}`;

    if (runsOffBat === 0) return "Dot ball";
    return `${runsOffBat} run${runsOffBat === 1 ? "" : "s"}`;
}

module.exports = {
    DismissedBatsmanPositions,
    NO_BALL_REASON_LABELS,
    buildCommentary,
    displayNoBallReason,
    isLegalDelivery,
    normalizeDismissedBatsmanPosition,
    normalizeExtraType,
    normalizeNoBallReason,
    resolveRunOutState
};
