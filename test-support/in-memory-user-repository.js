function clone(value) {
  return structuredClone(value);
}

export function createInMemoryUserRepository() {
  const users = new Map();
  const metaIdentityIndex = new Map();
  let identitySequence = 0;

  return {
    async findById(userId) {
      const user = users.get(userId);
      return !user || user.deletedAt ? null : clone(user);
    },

    async findByMetaUserId(metaUserId) {
      const userId = metaIdentityIndex.get(metaUserId);
      if (!userId) {
        return null;
      }

      const user = users.get(userId);
      return !user || user.deletedAt ? null : clone(user);
    },

    async list({ limit, offset }) {
      const activeUsers = [...users.values()]
        .filter((user) => !user.deletedAt)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

      return {
        users: clone(activeUsers.slice(offset, offset + limit)).map((user) => ({
          ...user,
          identities: [],
        })),
        total: activeUsers.length,
      };
    },

    async create({
      id,
      participantCode,
      metaUserId,
      controllerGuideVersionCompleted,
    }) {
      const timestamp = new Date().toISOString();
      const user = {
        id,
        participantCode,
        status: "active",
        controllerGuideVersionCompleted,
        playCount: 0,
        createdAt: timestamp,
        lastSeenAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        identities: [
          {
            id: String(++identitySequence),
            provider: "meta",
            providerUserId: metaUserId,
            lastVerifiedAt: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
      };

      users.set(id, user);
      metaIdentityIndex.set(metaUserId, id);
      return clone(user);
    },

    async update(userId, changes) {
      const user = users.get(userId);
      if (!user || user.deletedAt) {
        return null;
      }

      if (Object.hasOwn(changes, "status")) {
        user.status = changes.status;
      }
      if (Object.hasOwn(changes, "controllerGuideVersionCompleted")) {
        user.controllerGuideVersionCompleted =
          changes.controllerGuideVersionCompleted;
      }
      user.updatedAt = new Date().toISOString();

      return clone(user);
    },

    async softDelete(userId) {
      const user = users.get(userId);
      if (!user || user.deletedAt) {
        return false;
      }

      const timestamp = new Date().toISOString();
      user.status = "deleted";
      user.deletedAt = timestamp;
      user.updatedAt = timestamp;
      return true;
    },
  };
}
