import authConfigData from './authConfig.json';
import { UserRole } from '../types';

export interface SessionConfig {
  inactivityTimeoutMinutes: number;
  warningThresholdSeconds: number;
  activityEvents: string[];
}

export interface RoleDefinition {
  name: string;
  description: string;
  permissions: string[];
}

export interface ConfiguredUser {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  fullName: string;
  email: string;
}

export interface AuthConfig {
  session: SessionConfig;
  roles: Record<UserRole, RoleDefinition>;
  configuredUsers: ConfiguredUser[];
}

export const AUTH_CONFIG: AuthConfig = authConfigData as unknown as AuthConfig;

/**
 * Validates provided credentials strictly against configured user directory.
 */
export function verifyCredentials(
  username: string,
  password: string
): { success: boolean; user?: ConfiguredUser; message?: string } {
  const normalizedUsername = username.trim().toLowerCase();
  const matchedUser = AUTH_CONFIG.configuredUsers.find(
    (u) => u.username.toLowerCase() === normalizedUsername
  );

  if (!matchedUser) {
    return {
      success: false,
      message: `Invalid username "${username}". No matching account found in user directory.`,
    };
  }

  if (matchedUser.password !== password) {
    return {
      success: false,
      message: 'Invalid password. Credentials verification failed.',
    };
  }

  return {
    success: true,
    user: matchedUser,
  };
}

/**
 * Returns session inactivity timeout in milliseconds from configuration.
 */
export function getSessionTimeoutMs(): number {
  const minutes = AUTH_CONFIG.session?.inactivityTimeoutMinutes ?? 30;
  return minutes * 60 * 1000;
}
