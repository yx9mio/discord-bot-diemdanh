// tests/unit/permissions.test.js
// Test requireAdmin với mock Discord interaction
import { vi } from 'vitest';

// Mock discord.js và logger
vi.mock('discord.js', () => ({
  PermissionFlagsBits: {
    Administrator: 8n,
    ManageGuild: 32n,
  },
}));
