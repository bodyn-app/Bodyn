// Web preview: system notifications are not available, so everything here does nothing.
import type { PlannedNotification } from './types';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export const permissionState = async (): Promise<PermissionState> => 'unsupported';
export const requestPermission = async (): Promise<PermissionState> => 'unsupported';
export const syncSchedule = async (_plan: PlannedNotification[], _now = new Date()): Promise<number> => 0;
export const sendTest = async (): Promise<void> => {};
export const previewSchedule = async (_plan: PlannedNotification[], _now = new Date()): Promise<number> => 0;
