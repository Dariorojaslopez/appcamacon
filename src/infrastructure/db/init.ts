let initialized = false;

export async function initDatabase() {
  if (initialized) return;
  initialized = true;
}

