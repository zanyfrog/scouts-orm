"use strict";

const roles = {
  PUBLIC: "public",
  SCOUT: "scout",
  PARENT: "parent",
  ADULT_LEADER: "adult_leader",
  COMMITTEE_MEMBER: "committee_member",
  ADMINISTRATOR: "administrator",
};

function actorRoles(actor) {
  return new Set([
    ...(actor?.globalRoles || []),
    ...(actor?.unitRoles || []).map((assignment) => assignment.role),
  ]);
}

function hasAnyRole(actor, allowedRoles) {
  const assignedRoles = actorRoles(actor);
  return allowedRoles.some((role) => assignedRoles.has(role));
}

function hasAdministrator(actor) {
  return actorRoles(actor).has(roles.ADMINISTRATOR);
}

function hasOperationalAccess(actor) {
  return hasAdministrator(actor) || hasAnyRole(actor, [roles.ADULT_LEADER, roles.COMMITTEE_MEMBER]);
}

function hasOperationalWriteAccess(actor) {
  return hasAdministrator(actor) || hasAnyRole(actor, [roles.ADULT_LEADER]);
}

function hasScoutRole(actor) {
  return hasAnyRole(actor, [roles.SCOUT]);
}

function hasParentRole(actor) {
  return hasAnyRole(actor, [roles.PARENT]);
}

function hasAdultLeaderScoutAccess(actor) {
  return hasAdministrator(actor) || hasAnyRole(actor, [roles.ADULT_LEADER]);
}

function hasMemberAccess(actor) {
  return Boolean(actor?.authenticated) && hasAnyRole(actor, [
    roles.SCOUT,
    roles.PARENT,
    roles.ADULT_LEADER,
    roles.COMMITTEE_MEMBER,
    roles.ADMINISTRATOR,
  ]);
}

function actorPersonId(actor) {
  return actor?.person?.externalId || actor?.person?.id || "";
}

function linkedScoutIds(actor) {
  return new Set((actor?.relationships || []).map((relationship) => relationship.scoutPersonId));
}

function scoutIdsForActor(actor) {
  if (hasAdultLeaderScoutAccess(actor)) {
    return null;
  }
  const allowed = hasParentRole(actor) ? linkedScoutIds(actor) : new Set();
  if (hasScoutRole(actor) && actorPersonId(actor)) {
    allowed.add(actorPersonId(actor));
  }
  return allowed;
}

function canAccessScout(actor, scoutId) {
  if (hasAdultLeaderScoutAccess(actor)) {
    return true;
  }
  if (hasScoutRole(actor) && actorPersonId(actor) === scoutId) {
    return true;
  }
  return hasParentRole(actor) && linkedScoutIds(actor).has(scoutId);
}

function registrationPersonIdsForActor(actor, data = {}) {
  const allowed = new Set();
  if (!actor?.authenticated) {
    return allowed;
  }

  const actorId = actorPersonId(actor);
  if (actorId) {
    allowed.add(actorId);
  }

  if (!hasParentRole(actor)) {
    return allowed;
  }

  const linkedIds = linkedScoutIds(actor);
  linkedIds.forEach((scoutId) => allowed.add(scoutId));

  const relationships = Array.isArray(data?.adultScoutRelationships) ? data.adultScoutRelationships : [];
  relationships.forEach((relationship) => {
    if (linkedIds.has(relationship.scoutId) && relationship.adultId) {
      allowed.add(String(relationship.adultId));
    }
  });

  return allowed;
}

function canRegisterForPerson(actor, targetPersonId, data = {}) {
  const safeTargetPersonId = String(targetPersonId || "").trim();
  if (!safeTargetPersonId) {
    return false;
  }
  return registrationPersonIdsForActor(actor, data).has(safeTargetPersonId);
}

function applyScoutPatch(existingScout, patch, actor) {
  const allowedFields = hasAdultLeaderScoutAccess(actor)
    ? ["id", "name", "firstName", "lastName", "nickname", "gender", "patrol", "patrolBadge", "rank", "leadershipRole", "leadershipRoles", "avatar"]
    : ["firstName", "lastName", "nickname", "gender", "avatar"];
  const nextScout = { ...(existingScout || {}) };
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      nextScout[field] = patch[field];
    }
  }
  nextScout.id = existingScout?.id || patch.id;
  return nextScout;
}

module.exports = {
  roles,
  actorRoles,
  hasAnyRole,
  hasAdministrator,
  hasOperationalAccess,
  hasOperationalWriteAccess,
  hasAdultLeaderScoutAccess,
  hasMemberAccess,
  hasParentRole,
  actorPersonId,
  linkedScoutIds,
  scoutIdsForActor,
  canAccessScout,
  registrationPersonIdsForActor,
  canRegisterForPerson,
  applyScoutPatch,
};
