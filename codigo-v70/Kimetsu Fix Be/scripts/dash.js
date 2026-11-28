import { knockback } from "./compat.js";
import { system } from "@minecraft/server";

const dashingPlayers = new Map();


// ==============================
// CONTINUOUS DASH
// ==============================

function startContinuousDash(sourceEntity, force) {
    const id = sourceEntity.id;
    if (dashingPlayers.has(id)) return;

    const interval = system.runInterval(() => {
        if (!sourceEntity.isValid) return limparDash(id);
        const direction = sourceEntity.getViewDirection();

        knockback(sourceEntity,
            direction.x,
            direction.z,
            force,
            direction.y * force
        );
    }, 1);

    dashingPlayers.set(id, { interval });
}


// ==============================
// AIR DASH (FRENTE + CIMA)
// ==============================

function startAirDash(sourceEntity, forwardForce, upwardForce) {
    const id = sourceEntity.id;
    if (dashingPlayers.has(id)) return;

    const interval = system.runInterval(() => {
        if (!sourceEntity.isValid) return limparDash(id);
        const direction = sourceEntity.getViewDirection();

        sourceEntity.clearVelocity();

        sourceEntity.applyImpulse({
            x: direction.x * forwardForce,
            y: upwardForce,
            z: direction.z * forwardForce
        });
    }, 1);

    dashingPlayers.set(id, { interval });
}


// ==============================
// STOP DASH
// ==============================

function limparDash(id) {
    const data = dashingPlayers.get(id);
    if (!data) return false;
    system.clearRun(data.interval);
    dashingPlayers.delete(id);
    return true;
}

function stopDash(sourceEntity) {
    if (limparDash(sourceEntity.id) && sourceEntity.isValid) sourceEntity.clearVelocity();
}


// ==============================
// SINGLE DASH
// ==============================

function applySingleDash(sourceEntity, force) {
    const direction = sourceEntity.getViewDirection();

    knockback(sourceEntity,
        direction.x,
        direction.z,
        force,
        0
    );
}


// ==============================
// UP DASH
// ==============================

function applyUpDash(sourceEntity, force) {
    knockback(sourceEntity, 0, 0, 0, force);
}


// ==============================
// DIRECTIONAL DASH
// ==============================

function applyDirectionalDash(sourceEntity, force) {
    const direction = sourceEntity.getViewDirection();

    knockback(sourceEntity,
        direction.x,
        direction.z,
        force,
        direction.y * force
    );
}


// ==============================
// JUMP LOOP DASH
// ==============================

function startJumpLoopDash(sourceEntity, forwardForce, upwardForce, fallForce) {
    const id = sourceEntity.id;
    if (dashingPlayers.has(id)) return;

    const cooldownMs = 120;

    const interval = system.runInterval(() => {
        if (!sourceEntity.isValid) return limparDash(id);
        const now = Date.now();

        const data = dashingPlayers.get(id);
        if (!data) return;

        const direction = sourceEntity.getViewDirection();

        if (sourceEntity.isOnGround && now >= data.nextJump) {

            knockback(sourceEntity,
                direction.x,
                direction.z,
                forwardForce,
                upwardForce
            );

            data.nextJump = now + cooldownMs;

            dashingPlayers.set(id, data);

        } else {

            if (!sourceEntity.isOnGround && fallForce < 0) {
                knockback(sourceEntity, 0, 0, 0, fallForce);
            }
        }

    }, 1);

    dashingPlayers.set(id, {
        interval,
        nextJump: 0
    });
}


// ==============================
// EVENTS
// ==============================

system.afterEvents.scriptEventReceive.subscribe((event) => {

    const { id, message, sourceEntity } = event;
    if (!sourceEntity?.isValid) return;

    const args = message.split(" ");

    switch (id) {

        case "kny:forwards":
            startContinuousDash(
                sourceEntity,
                parseFloat(args[0] || "0")
            );
            break;

        case "kny:airDash":
            startAirDash(
                sourceEntity,
                parseFloat(args[0] || "1.5"), // frente
                parseFloat(args[1] || "0.35") // cima
            );
            break;

        case "kny:stopDash":
            stopDash(sourceEntity);
            break;

        case "kny:dash":
            applySingleDash(
                sourceEntity,
                parseFloat(args[0] || "0")
            );
            break;

        case "kny:upDash":
            applyUpDash(
                sourceEntity,
                parseFloat(args[0] || "0")
            );
            break;

        case "kny:directionalDash":
            applyDirectionalDash(
                sourceEntity,
                parseFloat(args[0] || "0")
            );
            break;

        case "kny:jumpDash":
            startJumpLoopDash(
                sourceEntity,
                parseFloat(args[0] || "1.2"),
                parseFloat(args[1] || "1.0"),
                parseFloat(args[2] || "0")
            );
            break;
    }
});
